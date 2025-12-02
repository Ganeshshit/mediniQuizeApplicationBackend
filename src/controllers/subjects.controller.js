// ============================================
// controllers/subjects.controller.js
// ============================================
const Subject = require('../models/Subject');

/**
 * GET /api/subjects
 * Accessible by: any authenticated user
 */
const listSubjects = async (req, res, next) => {
    try {
        // Optional: basic search/filter & sort via query params
        const { search, sortBy = 'name', order = 'asc' } = req.query;

        const filter = {};
        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const sort = {};
        sort[sortBy] = order === 'desc' ? -1 : 1;

        const subjects = await Subject.find(filter)
            .sort(sort)
            .lean();

        return res.status(200).json({
            data: subjects,
        });
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/subjects
 * Accessible by: trainer, admin
 */
const createSubject = async (req, res, next) => {
    try {
        const {
            name, code, description, department,
            semester, credits
        } = req.body;

        // Check duplicate by name or code
        const existing = await Subject.findOne({
            $or: [{ name: name.trim() }, { code: code.trim().toUpperCase() }]
        });

        if (existing) {
            return res.status(409).json({
                error: "Subject name or code already exists"
            });
        }

        const subject = await Subject.create({
            name: name.trim(),
            code: code.trim().toUpperCase(),
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

/**
 * PUT /api/subjects/:id
 * Accessible by: trainer, admin
 */
const updateSubject = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (description !== undefined) updates.description = description;

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
            data: subject,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({
                error: 'Subject already exists with this name',
            });
        }
        next(err);
    }
};

/**
 * DELETE /api/subjects/:id
 * Accessible by: admin
 */
const deleteSubject = async (req, res, next) => {
    try {
        const { id } = req.params;

        const subject = await Subject.findByIdAndDelete(id);

        if (!subject) {
            return res.status(404).json({ error: 'Subject not found' });
        }

        // If you prefer 204 No Content, you can change this status/response
        return res.status(200).json({
            message: 'Subject deleted successfully',
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    listSubjects,
    createSubject,
    updateSubject,
    deleteSubject,
};
