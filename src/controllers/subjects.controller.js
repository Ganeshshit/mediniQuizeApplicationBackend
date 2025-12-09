// ============================================
// controllers/subjects.controller.js
// ============================================
const Subject = require('../models/Subject');

const listSubjects = async (req, res, next) => {
    try {
        const { search, sortBy = 'name', order = 'asc' } = req.query;

        const filter = {};
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const sort = {};
        sort[sortBy] = order === 'desc' ? -1 : 1;

        const subjects = await Subject.find(filter).sort(sort).lean();

        return res.status(200).json({ data: subjects });

    } catch (err) {
        next(err);
    }
};

const createSubject = async (req, res, next) => {
    try {
        const { name, code, description, department, semester, credits } = req.body;

        const normalizedName = name.trim();
        const normalizedCode = code.trim().toUpperCase();

        const existing = await Subject.findOne({
            $or: [{ name: normalizedName }, { code: normalizedCode }]
        });

        if (existing) {
            return res.status(409).json({
                error: "Subject name or code already exists"
            });
        }

        const subject = await Subject.create({
            name: normalizedName,
            code: normalizedCode,
            description,
            department,
            semester,
            credits,
            createdBy: req.user._id
        });

        return res.status(201).json({
            message: "Subject created successfully",
            data: subject
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                error: "Duplicate subject name or code"
            });
        }
        next(err);
    }
};

const updateSubject = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updates = {};
        if (name) updates.name = name.trim();
        if (description) updates.description = description;

        const subject = await Subject.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        return res.status(200).json({
            message: 'Subject updated successfully',
            data: subject
        });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                error: 'Duplicate subject name already exists'
            });
        }
        next(err);
    }
};

const deleteSubject = async (req, res, next) => {
    try {
        const { id } = req.params;

        const subject = await Subject.findByIdAndDelete(id);
        if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        return res.status(200).json({ message: 'Subject deleted successfully' });

    } catch (err) {
        next(err);
    }
};

module.exports = {
    listSubjects,
    createSubject,
    updateSubject,
    deleteSubject
};
