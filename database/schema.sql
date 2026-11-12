CREATE DATABASE IF NOT EXISTS food_delivery;
USE food_delivery;

CREATE TABLE IF NOT EXISTS menu_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  price DECIMAL(8,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  emoji VARCHAR(10) DEFAULT '🍽️',
  available BOOLEAN DEFAULT TRUE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS riders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone CHAR(10) NOT NULL UNIQUE,
  pin_hash VARCHAR(200) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address VARCHAR(255) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status ENUM('Placed','Preparing','On the way','Delivered') NOT NULL DEFAULT 'Placed',
  rider_id INT NULL,
  delivery_code CHAR(4) NULL,
  code_attempts TINYINT NOT NULL DEFAULT 0,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rider_id) REFERENCES riders(id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_item_id INT NOT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(8,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  status VARCHAR(120) NOT NULL,
  changed_by VARCHAR(120) NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaints (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  reason VARCHAR(60) NOT NULL,
  details VARCHAR(500),
  status ENUM('Open','Resolved') NOT NULL DEFAULT 'Open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) DEFAULT CHARSET=utf8mb4;

INSERT INTO menu_items (name, description, price, category, emoji) VALUES
('Chicken Biryani', 'Basmati rice cooked with spiced chicken', 180, 'Main Course', '🍛'),
('Veg Fried Rice', 'Wok-tossed rice with fresh vegetables', 120, 'Main Course', '🍚'),
('Parotta with Salna', 'Layered parotta served with salna', 90, 'Main Course', '🫓'),
('Butter Chicken', 'Creamy tomato gravy with tender chicken', 220, 'Main Course', '🍗'),
('Paneer Tikka', 'Grilled paneer with mint chutney', 160, 'Starters', '🧆'),
('Chicken 65', 'Crispy spicy fried chicken', 150, 'Starters', '🍖'),
('French Fries', 'Crispy salted fries', 80, 'Starters', '🍟'),
('Veg Burger', 'Crispy patty with fresh veggies', 100, 'Fast Food', '🍔'),
('Cheese Pizza', 'Loaded with mozzarella', 199, 'Fast Food', '🍕'),
('Filter Coffee', 'Hot South Indian filter coffee', 30, 'Drinks', '☕'),
('Fresh Lime Soda', 'Sweet or salted', 40, 'Drinks', '🥤'),
('Gulab Jamun', 'Two pieces in sugar syrup', 60, 'Desserts', '🍮');
