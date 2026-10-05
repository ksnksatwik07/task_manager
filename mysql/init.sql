-- Runs once, only when MySQL starts with an EMPTY data directory.
-- Database (taskdb) and user (taskuser) are created by the MYSQL_* env vars of the image.
USE taskdb;

CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tasks (title, description)
VALUES
('Learn Docker', 'Practice Docker containers'),
('Learn Kubernetes', 'Practice Pods and Deployments'),
('Learn PV and PVC', 'Practice Kubernetes persistent storage');
