use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use crate::customer::CustomerRepository;

use super::{
    august_range, cleanup, create_write, seed_customers, temp_path, update_write,
    ScheduleRepository, CUSTOMER_ONE,
};

#[derive(Clone, Copy)]
enum Mutation {
    Create,
    Update,
    Complete,
}

fn assert_customer_delete_waits_for_response(mutation: Mutation) {
    let path = temp_path("response-transaction");
    seed_customers(&path);
    let schedules = Arc::new(ScheduleRepository::open(&path).expect("schedule repository"));
    let existing = match mutation {
        Mutation::Create => None,
        Mutation::Update => Some(
            schedules
                .create(create_write("합성 수정 전", "2026-08-06", None, None))
                .expect("create unlinked schedule"),
        ),
        Mutation::Complete => Some(
            schedules
                .create(create_write(
                    "합성 완료 전",
                    "2026-08-06",
                    None,
                    Some(CUSTOMER_ONE),
                ))
                .expect("create linked schedule"),
        ),
    };
    let (entered_sender, entered_receiver) = mpsc::channel();
    let (release_sender, release_receiver) = mpsc::channel();
    let release_receiver = Arc::new(Mutex::new(release_receiver));
    schedules.set_mutation_hook(Arc::new(move || {
        entered_sender
            .send(())
            .expect("signal mutation response window");
        release_receiver
            .lock()
            .expect("release receiver lock")
            .recv()
            .expect("release mutation response window");
    }));

    let schedule_thread = {
        let schedules = Arc::clone(&schedules);
        thread::spawn(move || match mutation {
            Mutation::Create => schedules.create(create_write(
                "합성 연결 생성",
                "2026-08-06",
                None,
                Some(CUSTOMER_ONE),
            )),
            Mutation::Update => schedules.update(
                &existing.expect("update schedule").id,
                update_write(Some(CUSTOMER_ONE)),
            ),
            Mutation::Complete => {
                schedules.set_completed(&existing.expect("completion schedule").id, true)
            }
        })
    };
    entered_receiver
        .recv_timeout(Duration::from_secs(2))
        .expect("mutation reached response read");

    let (deleted_sender, deleted_receiver) = mpsc::channel();
    let customer_thread = {
        let path = path.clone();
        thread::spawn(move || {
            let customers = CustomerRepository::open(&path).expect("customer repository");
            let result = customers.soft_delete(CUSTOMER_ONE);
            deleted_sender
                .send(result)
                .expect("send customer delete result");
        })
    };
    assert!(deleted_receiver
        .recv_timeout(Duration::from_millis(100))
        .is_err());

    release_sender
        .send(())
        .expect("release schedule transaction");
    let schedule = schedule_thread
        .join()
        .expect("schedule mutation thread")
        .expect("schedule mutation response");
    assert_eq!(schedule.customer_id.as_deref(), Some(CUSTOMER_ONE));
    deleted_receiver
        .recv_timeout(Duration::from_secs(2))
        .expect("customer delete completed")
        .expect("customer soft delete");
    customer_thread.join().expect("customer mutation thread");
    assert!(schedules
        .list(&august_range())
        .expect("list hidden linked schedule")
        .is_empty());

    drop(schedules);
    cleanup(&path);
}

#[test]
fn linked_create_returns_before_concurrent_customer_delete() {
    assert_customer_delete_waits_for_response(Mutation::Create);
}

#[test]
fn linked_update_returns_before_concurrent_customer_delete() {
    assert_customer_delete_waits_for_response(Mutation::Update);
}

#[test]
fn completion_returns_before_concurrent_customer_delete() {
    assert_customer_delete_waits_for_response(Mutation::Complete);
}
