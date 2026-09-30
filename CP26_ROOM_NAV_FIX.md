# CP26 Revision — Room Identity + Bottom Navigation

## Fixed automatically in Supabase
Room 01 is now permanently the free Standard Room: 12 slots, +0% Room H/s. Historical transaction/spend records are not deleted.

## Frontend fixes
- Remove the confusing `ROOM 01 · LEVEL 3` presentation.
- Room 01 displays `STANDARD ROOM`; Room 02–05 display their own tier names.
- Locked Room 02–05 cards explain the room's purpose, price, 12-slot capacity, Room H/s bonus, and unique features.
- Every room uses a distinct visual theme.
- Bottom navigation changes from `Profile` to `Wallet`.
- Profile remains available from the top-right avatar in the Topbar.

## Manual GitHub paths
- `app/rooms/[roomNumber]/page.tsx`
- `app/rooms/RoomsPage.module.css`
- `components/layout/BottomNav.tsx`

GitHub was not modified automatically.
