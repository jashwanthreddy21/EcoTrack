# EcoTrack Database Design & Data Dictionary
## Normalized PostgreSQL Schema & Firestore Entity Mapping

---

## 1. Relational Entities (PostgreSQL 16)

### Table: `users`
- `id` VARCHAR(64) PRIMARY KEY
- `name` VARCHAR(100) NOT NULL
- `email` VARCHAR(100) UNIQUE NOT NULL
- `role` VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor', 'collector', 'citizen'))
- `phone` VARCHAR(20)
- `area` VARCHAR(100)
- `ward` VARCHAR(50)
- `pincode` VARCHAR(10)
- `active` BOOLEAN DEFAULT TRUE
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `households`
- `id` VARCHAR(64) PRIMARY KEY
- `citizen_id` VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE
- `house_number` VARCHAR(50)
- `address` VARCHAR(255) NOT NULL
- `area` VARCHAR(100) NOT NULL
- `ward` VARCHAR(50) NOT NULL
- `landmark` VARCHAR(100)
- `pincode` VARCHAR(10) NOT NULL
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `waste_categories`
- `id` VARCHAR(64) PRIMARY KEY
- `name` VARCHAR(50) NOT NULL
- `description` TEXT
- `instructions` TEXT
- `color` VARCHAR(20)
- `active` BOOLEAN DEFAULT TRUE

### Table: `pickup_requests`
- `id` VARCHAR(64) PRIMARY KEY
- `request_number` VARCHAR(30) UNIQUE NOT NULL (e.g., `ECOTRACK-REQ-1001`)
- `citizen_id` VARCHAR(64) REFERENCES users(id)
- `household_id` VARCHAR(64) REFERENCES households(id)
- `category_id` VARCHAR(64) REFERENCES waste_categories(id)
- `quantity_kg` NUMERIC(6,2) NOT NULL
- `actual_quantity_kg` NUMERIC(6,2)
- `preferred_date` DATE NOT NULL
- `preferred_time_slot` VARCHAR(50) NOT NULL
- `scheduled_date` DATE
- `scheduled_time_slot` VARCHAR(50)
- `assigned_collector_id` VARCHAR(64) REFERENCES users(id)
- `status` VARCHAR(30) NOT NULL
- `missed_reason` VARCHAR(100)
- `missed_remarks` TEXT
- `completion_remarks` TEXT
- `completed_at` TIMESTAMP
- `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### Table: `collection_schedules`
- `id` VARCHAR(64) PRIMARY KEY
- `date` DATE NOT NULL
- `time_slot` VARCHAR(50) NOT NULL
- `area` VARCHAR(100) NOT NULL
- `ward` VARCHAR(50) NOT NULL
- `collector_id` VARCHAR(64) REFERENCES users(id)
- `total_pickups` INTEGER DEFAULT 0
- `completed_pickups` INTEGER DEFAULT 0
- `pending_pickups` INTEGER DEFAULT 0
- `missed_pickups` INTEGER DEFAULT 0
- `status` VARCHAR(20) DEFAULT 'Scheduled'

### Table: `pickup_status_history`
- `id` VARCHAR(64) PRIMARY KEY
- `pickup_request_id` VARCHAR(64) REFERENCES pickup_requests(id) ON DELETE CASCADE
- `previous_status` VARCHAR(30)
- `new_status` VARCHAR(30) NOT NULL
- `changed_by` VARCHAR(64)
- `changed_by_name` VARCHAR(100)
- `reason` VARCHAR(100)
- `remarks` TEXT
- `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP

---

## 2. Integrity Constraints & Business Invariants
1. **Uniqueness**: Every pickup request receives an immutable reference number `ECOTRACK-REQ-{number}`.
2. **Terminal Locking**: Requests marked `Completed`, `Cancelled`, or `Rejected` cannot transition backwards.
3. **Collision Avoidance**: A collector cannot be scheduled in two conflicting wards during the same time slot window.
