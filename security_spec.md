# Security Specification for Re-Marmitaria

## Data Invariants
- An order must have at least one item.
- An order status must always start as 'Pendente' when created by a customer.
- Only admins can change order status or modify the menu.
- Menu items must have a name and a valid price.

## The "Dirty Dozen" Payloads (Examples)

1. **Identity Spoofing**: Attempt to create an order with a pre-set 'Entregue' status.
2. **Identity Spoofing**: Attempt to update another user's order (as a non-admin).
3. **Privilege Escalation**: Attempt to modify the menu without being an admin.
4. **Data Integrity**: Create an order with a negative total.
5. **Data Integrity**: Create an order with an empty list of items.
6. **Resource Poisoning**: Create a menu item with a 1MB string as a name.
7. **Resource Poisoning**: Update a menu day with 10,000 dishes.
8. **Bypassing Validation**: Update only the 'status' of an order to something invalid.
9. **Timestamp Spoofing**: Create an order with a `createdAt` date in the future.
10. **ID Injection**: Create a document with an ID containing malicious symbols.
11. **PII Leakage**: Attempt to list all orders as a normal user.
12. **Update Gap**: Modify the `total` of an order after it was created.

## Test Runner (firestore.rules.test.ts)
(To be implemented if testing environment is available, otherwise logic captured in rules)
