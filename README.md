# Online Food Delivery Website

Full-stack app where users browse a menu, build a cart, place orders and track delivery status.
Rebuilt version of my final-year B.Sc. project.

**Tech:** HTML, CSS, JavaScript, Node.js, Express, MySQL

## Features
- Menu loaded from MySQL, with category filter
- Dynamic cart (add, change quantity, remove) saved in the browser
- Order placement with server-side price calculation and a database transaction
- Order tracking page (Placed, Preparing, On the way, Delivered) that refreshes every 5 seconds
- Rider page: login with phone and PIN, sees only assigned orders, taps to call the customer, marks picked up
- Proof of delivery: the customer gets a 4-digit code and the rider must enter it to mark an order Delivered
- Order history log (who changed which status and when) and customer complaints with an admin review list
- Admin page: revenue, assign riders, add riders, change status, resolve complaints (admin key protected)
- Responsive layout for phone and desktop

## API
| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/menu | List available menu items |
| POST | /api/orders | Place an order |
| GET | /api/orders/:id?phone= | Track an order (needs the phone used for the order) |
| GET | /api/orders | List recent orders (admin key) |
| PATCH | /api/orders/:id/status | Update status (admin key) |
| PATCH | /api/orders/:id/rider | Assign a rider (admin key) |
| POST | /api/orders/:id/complaints | Customer reports a problem |
| GET, POST | /api/riders | List or add riders (admin key) |
| POST | /api/rider/login | Rider login |
| GET | /api/rider/orders | Rider's active orders |
| POST | /api/rider/orders/:id/pickup | Rider marks picked up |
| POST | /api/rider/orders/:id/deliver | Rider confirms delivery with the customer's code |
| GET, PATCH | /api/complaints | Review complaints (admin key) |

## Run locally
1. Install Node.js 18+ and MySQL
2. Create the database: run `database/schema.sql` in MySQL Workbench (File > Open SQL Script, then Execute)
3. `cd backend`, then `copy .env.example .env` and fill in your MySQL password and an admin key
4. `npm install`, then `npm start`
5. Open http://localhost:3000 (admin page: http://localhost:3000/admin.html)

Rider page: http://localhost:3000/rider.html

## Known limitations
- Admin uses one shared key and riders use a PIN. A production app would use full accounts with sessions.
- Order tracking refreshes by polling every 5 seconds, not WebSockets.
- Payment is cash on delivery only.
