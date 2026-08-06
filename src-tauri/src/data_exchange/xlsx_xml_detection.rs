use std::io::BufRead;

use quick_xml::events::Event;
use quick_xml::Reader;

pub(super) fn contains_sheet_data<R: BufRead>(
    xml: &mut Reader<R>,
    buffer: &mut Vec<u8>,
) -> Result<bool, quick_xml::Error> {
    // Calamine locates the first `sheetData` element without requiring a
    // `worksheet` root. Sniff the bounded archive entry to keep malformed
    // wrapper documents from bypassing the raw-cell preflight.
    loop {
        buffer.clear();
        match xml.read_event_into(buffer) {
            Ok(Event::Start(element)) if element.local_name().as_ref() == b"sheetData" => {
                return Ok(true);
            }
            Ok(Event::Eof) => return Ok(false),
            Err(error) => return Err(error),
            _ => {}
        }
    }
}
