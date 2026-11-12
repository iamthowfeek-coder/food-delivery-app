-- Run this ONCE on your existing food_delivery database (MySQL Workbench).
USE food_delivery;

CREATE TABLE riders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone CHAR(10) NOT NULL UNIQUE,
  pin_hash VARCHAR(200) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders
  ADD COLUMN rider_id INT NULL,
  ADD COLUMN delivery_code CHAR(4) NULL,
  ADD COLUMN code_attempts TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN delivered_at TIMESTAMP NULL,
  ADD FOREIGN KEY (rider_id) REFERENCES riders(id);

UPDATE orders SET delivery_code = LPAD(FLOOR(RAND() * 10000), 4, '0') WHERE delivery_code IS NULL;

CREATE TABLE order_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status VARCHAR(120) NOT NULL,
  changed_by VARCHAR(120) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

INSERT INTO order_history (order_id, status, changed_by) SELECT id, status, 'system' FROM orders;

CREATE TABLE complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  reason VARCHAR(60) NOT NULL,
  details VARCHAR(500),
  status ENUM('Open','Resolved') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;
