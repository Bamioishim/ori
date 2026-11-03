# ORI implementation TODO

## Guarded 1Click settlement boundary

- [x] Add a server-only 1Click quote endpoint that keeps the JWT out of the browser.
- [x] Validate supported assets, destination/refund addresses, amount, and deadline before forwarding requests.
- [x] Add a server-only status endpoint that proxies deposit-address status polling.
- [x] Add typed browser helpers for creating a live quote and polling settlement status.
- [x] Keep the existing dry-run quote path unchanged by default.
- [ ] Connect the payment confirmation sheet to the live quote flow behind an explicit feature flag.
- [ ] Add wallet signing/deposit support for the selected origin chain.
- [ ] Render deposit address, status transitions, transaction hashes, and refund/failure states in the receipt.
- [ ] Add unit and e2e coverage for quote validation and settlement state transitions.
- [ ] Configure `ORI_1CLICK_JWT` and a controlled recipient before enabling live mode.
