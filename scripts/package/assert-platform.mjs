import process from "node:process";

const platforms = {
  macos: { actual: "darwin", label: "macOS" },
  windows: { actual: "win32", label: "Windows" },
};
const requested = process.argv[2];
const contract = platforms[requested];

if (!contract) throw new Error("BODAM package platform must be macos or windows");
if (process.platform !== contract.actual) {
  throw new Error(`BODAM ${contract.label} installer must be built on ${contract.label}`);
}

globalThis.console.log(`BODAM ${contract.label} packaging platform verified`);
