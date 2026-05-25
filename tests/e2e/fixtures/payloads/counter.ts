// Shared monotonic update_id counter so all payload factories stay in sequence
let _counter = 1_000_000_000;
export function nextUpdateId(): number { return ++_counter; }
export function resetCounter(): void { _counter = 1_000_000_000; }
