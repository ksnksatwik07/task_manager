const express = require('express');
const c = require('../controllers/taskController');

const router = express.Router();

router.get('/', c.getTasks);
router.get('/:id', c.getTask);
router.post('/', c.createTask);
router.put('/:id', c.updateTask);
router.delete('/:id', c.deleteTask);

module.exports = router;
