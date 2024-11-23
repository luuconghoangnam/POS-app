const express = require('express');
const router = express.Router();
const Supplier = require('../models/supplier');

// Thêm nhà cung cấp
router.post('/add', async (req, res) => {
  try {
    const supplier = new Supplier(req.body);
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Sửa thông tin nhà cung cấp
router.put('/update/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!supplier) return res.status(404).json({ message: 'Nhà cung cấp không tồn tại' });
    res.json(supplier);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Xóa nhà cung cấp
router.delete('/delete/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Nhà cung cấp không tồn tại' });
    res.json({ message: 'Đã xóa nhà cung cấp' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;