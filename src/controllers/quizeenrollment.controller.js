// controllers/quizEnrollment.controller.js
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const QuizEnrollment = require('../models/QuizEnrollment');
const QuizAttempt = require('../models/QuizAttempt');
const mongoose = require('mongoose');
const logger = require('../config/logger');

class QuizEnrollmentController {
    // ============================================
    // VERIFY QUIZ OWNERSHIP
    // ============================================
    async verifyQuizOwnership(quizId, userId, userRole) {
        const quiz = await Quiz.findById(quizId);

        if (!quiz) {
            throw new Error('Quiz not found');
        }

        // Admin can access all quizzes
        if (userRole === 'admin') {
            return quiz;
        }

        // Trainer can only access their own quizzes
        if (userRole === 'trainer' && quiz.createdBy.toString() !== userId.toString()) {
            throw new Error('Access denied: You can only manage enrollments for your own quizzes');
        }

        return quiz;
    }

    // ============================================
    // GET AVAILABLE STUDENTS
    // ============================================
    async getAvailableStudents(req, res, next) {
        try {
            const {
                page = 1,
                limit = 20,
                search = '',
                semester,
                department,
                registeredFrom,
                registeredTo,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build query for students only
            const query = {
                role: 'student',
                isActive: true
            };

            // Search filter
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { rollNo: { $regex: search, $options: 'i' } },
                    { registrationNo: { $regex: search, $options: 'i' } }
                ];
            }

            // Semester filter
            if (semester) {
                query.semester = parseInt(semester);
            }

            // Department filter
            if (department && department !== '') {
                query.department = { $regex: department, $options: 'i' };
            }

            // Registration date filter
            if (registeredFrom || registeredTo) {
                query.createdAt = {};
                if (registeredFrom) {
                    query.createdAt.$gte = new Date(registeredFrom);
                }
                if (registeredTo) {
                    query.createdAt.$lte = new Date(registeredTo);
                }
            }

            // Sorting
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            // Execute query
            const [students, total] = await Promise.all([
                User.find(query)
                    .select('name email rollNo registrationNo semester department batch phone createdAt')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                User.countDocuments(query)
            ]);

            res.json({
                success: true,
                data: students,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                }
            });
        } catch (error) {
            logger.error('Get available students error:', error);
            next(error);
        }
    }

    // ============================================
    // GET ENROLLED STUDENTS FOR A QUIZ
    // ============================================
    async getEnrolledStudents(req, res, next) {
        try {
            const { quizId } = req.params;
            const { page = 1, limit = 20, search = '' } = req.query;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Build enrollment query
            const enrollmentQuery = { quiz: quizId };

            // If search, find matching students first
            let studentIds = null;
            if (search) {
                const students = await User.find({
                    role: 'student',
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { rollNo: { $regex: search, $options: 'i' } },
                        { registrationNo: { $regex: search, $options: 'i' } }
                    ]
                }).select('_id');

                studentIds = students.map(s => s._id);
                enrollmentQuery.student = { $in: studentIds };
            }

            // Get enrollments
            const [enrollments, total] = await Promise.all([
                QuizEnrollment.find(enrollmentQuery)
                    .populate('student', 'name email rollNo registrationNo semester department batch phone createdAt')
                    .sort({ enrolledAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                QuizEnrollment.countDocuments(enrollmentQuery)
            ]);

            // Enrich with attempt statistics
            const enrichedEnrollments = await Promise.all(
                enrollments.map(async (enrollment) => {
                    const attempts = await QuizAttempt.find({
                        quiz: quizId,
                        user: enrollment.student._id
                    }).select('status totalScore maxScore startTime endTime');

                    const completedAttempts = attempts.filter(a =>
                        ['submitted', 'auto_graded', 'manually_graded'].includes(a.status)
                    );

                    return {
                        _id: enrollment._id,
                        student: enrollment.student,
                        enrolledAt: enrollment.enrolledAt,
                        attempts: {
                            total: attempts.length,
                            completed: completedAttempts.length,
                            inProgress: attempts.filter(a => a.status === 'in_progress').length,
                            bestScore: completedAttempts.length > 0
                                ? Math.max(...completedAttempts.map(a => a.totalScore || 0))
                                : null,
                            lastAttemptDate: attempts.length > 0
                                ? attempts[attempts.length - 1].startTime
                                : null
                        }
                    };
                })
            );

            res.json({
                success: true,
                data: enrichedEnrollments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                },
                quiz: {
                    id: quiz._id,
                    title: quiz.title,
                    isPublished: quiz.isPublished
                }
            });
        } catch (error) {
            logger.error('Get enrolled students error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    // ============================================
    // GET NOT ENROLLED STUDENTS
    // ============================================
    async getNotEnrolledStudents(req, res, next) {
        try {
            const { quizId } = req.params;
            const {
                page = 1,
                limit = 20,
                search = '',
                semester,
                department,
                registeredFrom,
                registeredTo
            } = req.query;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            const skip = (parseInt(page) - 1) * parseInt(limit);

            // Get already enrolled student IDs
            const enrolledStudents = await QuizEnrollment.find({ quiz: quizId })
                .select('student')
                .lean();
            const enrolledStudentIds = enrolledStudents.map(e => e.student);

            // Build query for NOT enrolled students
            const query = {
                role: 'student',
                isActive: true,
                _id: { $nin: enrolledStudentIds }
            };

            // Search filter
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                    { rollNo: { $regex: search, $options: 'i' } },
                    { registrationNo: { $regex: search, $options: 'i' } }
                ];
            }

            // Semester filter
            if (semester) {
                query.semester = parseInt(semester);
            }

            // Department filter
            if (department && department !== '') {
                query.department = { $regex: department, $options: 'i' };
            }

            // Registration date filter
            if (registeredFrom || registeredTo) {
                query.createdAt = {};
                if (registeredFrom) {
                    query.createdAt.$gte = new Date(registeredFrom);
                }
                if (registeredTo) {
                    query.createdAt.$lte = new Date(registeredTo);
                }
            }

            // Get students
            const [students, total] = await Promise.all([
                User.find(query)
                    .select('name email rollNo registrationNo semester department batch phone createdAt')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(parseInt(limit))
                    .lean(),
                User.countDocuments(query)
            ]);

            res.json({
                success: true,
                data: students,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit))
                },
                quiz: {
                    id: quiz._id,
                    title: quiz.title,
                    isPublished: quiz.isPublished
                }
            });
        } catch (error) {
            logger.error('Get not enrolled students error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }

    // ============================================
    // ENROLL SINGLE STUDENT
    // ============================================
    async enrollSingleStudent(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { studentId } = req.body;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Verify student exists
            const student = await User.findOne({
                _id: studentId,
                role: 'student',
                isActive: true
            }).session(session);

            if (!student) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Student not found or inactive'
                });
            }

            // Check if already enrolled
            const existingEnrollment = await QuizEnrollment.findOne({
                quiz: quizId,
                student: studentId
            }).session(session);

            if (existingEnrollment) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Student is already enrolled in this quiz'
                });
            }

            // Create enrollment
            const enrollment = new QuizEnrollment({
                quiz: quizId,
                student: studentId,
                enrolledAt: new Date()
            });

            await enrollment.save({ session });
            await session.commitTransaction();

            await enrollment.populate('student', 'name email rollNo registrationNo semester department');

            logger.info(`Student ${studentId} enrolled in quiz ${quizId} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                message: 'Student enrolled successfully',
                data: enrollment
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Enroll single student error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        } finally {
            session.endSession();
        }
    }

    // ============================================
    // ENROLL MULTIPLE STUDENTS
    // ============================================
    async enrollMultipleStudents(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { studentIds } = req.body;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Verify all students exist
            const students = await User.find({
                _id: { $in: studentIds },
                role: 'student',
                isActive: true
            }).session(session);

            if (students.length !== studentIds.length) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Some student IDs are invalid or inactive'
                });
            }

            // Get already enrolled students
            const existingEnrollments = await QuizEnrollment.find({
                quiz: quizId,
                student: { $in: studentIds }
            }).session(session);

            const alreadyEnrolledIds = existingEnrollments.map(e => e.student.toString());
            const newStudentIds = studentIds.filter(id => !alreadyEnrolledIds.includes(id.toString()));

            if (newStudentIds.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'All students are already enrolled'
                });
            }

            // Create enrollments
            const enrollments = newStudentIds.map(studentId => ({
                quiz: quizId,
                student: studentId,
                enrolledAt: new Date()
            }));

            const createdEnrollments = await QuizEnrollment.insertMany(enrollments, { session });
            await session.commitTransaction();

            logger.info(`${createdEnrollments.length} students enrolled in quiz ${quizId} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                message: `${createdEnrollments.length} students enrolled successfully`,
                data: {
                    enrolled: createdEnrollments.length,
                    skipped: alreadyEnrolledIds.length,
                    total: studentIds.length
                }
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Enroll multiple students error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        } finally {
            session.endSession();
        }
    }

    // ============================================
    // ENROLL BY CRITERIA
    // ============================================
    async enrollByCriteria(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { semester, department, registeredFrom, registeredTo, enrollAll } = req.body;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Build student query
            const studentQuery = {
                role: 'student',
                isActive: true
            };

            if (!enrollAll) {
                if (semester) {
                    studentQuery.semester = parseInt(semester);
                }
                if (department && department !== '') {
                    studentQuery.department = { $regex: department, $options: 'i' };
                }
                if (registeredFrom || registeredTo) {
                    studentQuery.createdAt = {};
                    if (registeredFrom) {
                        studentQuery.createdAt.$gte = new Date(registeredFrom);
                    }
                    if (registeredTo) {
                        studentQuery.createdAt.$lte = new Date(registeredTo);
                    }
                }

                // Ensure at least one criteria is provided
                if (!semester && !department && !registeredFrom && !registeredTo) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        success: false,
                        error: 'At least one criteria must be provided (semester, department, or date range)'
                    });
                }
            }

            // Get matching students
            const students = await User.find(studentQuery)
                .select('_id')
                .session(session);

            if (students.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'No students found matching the criteria'
                });
            }

            const studentIds = students.map(s => s._id);

            // Get already enrolled students
            const existingEnrollments = await QuizEnrollment.find({
                quiz: quizId,
                student: { $in: studentIds }
            }).session(session);

            const alreadyEnrolledIds = existingEnrollments.map(e => e.student.toString());
            const newStudentIds = studentIds.filter(id => !alreadyEnrolledIds.includes(id.toString()));

            if (newStudentIds.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'All matching students are already enrolled'
                });
            }

            // Create enrollments
            const enrollments = newStudentIds.map(studentId => ({
                quiz: quizId,
                student: studentId,
                enrolledAt: new Date()
            }));

            const createdEnrollments = await QuizEnrollment.insertMany(enrollments, { session });
            await session.commitTransaction();

            logger.info(`${createdEnrollments.length} students enrolled by criteria in quiz ${quizId} by ${req.user.email}`);

            res.status(201).json({
                success: true,
                message: `${createdEnrollments.length} students enrolled successfully`,
                data: {
                    enrolled: createdEnrollments.length,
                    skipped: alreadyEnrolledIds.length,
                    total: studentIds.length,
                    criteria: { semester, department, registeredFrom, registeredTo, enrollAll }
                }
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Enroll by criteria error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        } finally {
            session.endSession();
        }
    }

    // ============================================
    // UNENROLL SINGLE STUDENT
    // ============================================
    async unenrollSingleStudent(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { studentId } = req.body;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Check if student has attempts
            const attemptCount = await QuizAttempt.countDocuments({
                quiz: quizId,
                user: studentId
            }).session(session);

            if (attemptCount > 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'Cannot unenroll student who has already attempted the quiz',
                    attemptCount
                });
            }

            // Delete enrollment
            const result = await QuizEnrollment.deleteOne({
                quiz: quizId,
                student: studentId
            }).session(session);

            if (result.deletedCount === 0) {
                await session.abortTransaction();
                return res.status(404).json({
                    success: false,
                    error: 'Enrollment not found'
                });
            }

            await session.commitTransaction();

            logger.info(`Student ${studentId} unenrolled from quiz ${quizId} by ${req.user.email}`);

            res.json({
                success: true,
                message: 'Student unenrolled successfully'
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Unenroll single student error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        } finally {
            session.endSession();
        }
    }

    // ============================================
    // UNENROLL MULTIPLE STUDENTS
    // ============================================
    async unenrollMultipleStudents(req, res, next) {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const { quizId } = req.params;
            const { studentIds } = req.body;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Check which students have attempts
            const studentsWithAttempts = await QuizAttempt.distinct('user', {
                quiz: quizId,
                user: { $in: studentIds }
            }).session(session);

            const studentIdsWithAttempts = studentsWithAttempts.map(id => id.toString());
            const safeToUnenrollIds = studentIds.filter(
                id => !studentIdsWithAttempts.includes(id.toString())
            );

            if (safeToUnenrollIds.length === 0) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    error: 'All selected students have already attempted the quiz',
                    studentsWithAttempts: studentIdsWithAttempts.length
                });
            }

            // Delete enrollments
            const result = await QuizEnrollment.deleteMany({
                quiz: quizId,
                student: { $in: safeToUnenrollIds }
            }).session(session);

            await session.commitTransaction();

            logger.info(`${result.deletedCount} students unenrolled from quiz ${quizId} by ${req.user.email}`);

            res.json({
                success: true,
                message: `${result.deletedCount} students unenrolled successfully`,
                data: {
                    unenrolled: result.deletedCount,
                    skipped: studentIdsWithAttempts.length,
                    total: studentIds.length
                }
            });
        } catch (error) {
            await session.abortTransaction();
            logger.error('Unenroll multiple students error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        } finally {
            session.endSession();
        }
    }

    // ============================================
    // GET ENROLLMENT STATISTICS
    // ============================================
    async getEnrollmentStatistics(req, res, next) {
        try {
            const { quizId } = req.params;

            // Verify ownership
            const quiz = await this.verifyQuizOwnership(quizId, req.user._id, req.user.role);

            // Get total students
            const totalStudents = await User.countDocuments({
                role: 'student',
                isActive: true
            });

            // Get enrolled students
            const enrolledCount = await QuizEnrollment.countDocuments({ quiz: quizId });

            // Get students with attempts
            const studentsWithAttempts = await QuizAttempt.distinct('user', { quiz: quizId });

            // Get department-wise enrollment
            const enrollments = await QuizEnrollment.find({ quiz: quizId })
                .populate('student', 'department semester');

            const departmentStats = {};
            const semesterStats = {};

            enrollments.forEach(enrollment => {
                const dept = enrollment.student.department || 'Unknown';
                const sem = enrollment.student.semester || 0;

                departmentStats[dept] = (departmentStats[dept] || 0) + 1;
                semesterStats[sem] = (semesterStats[sem] || 0) + 1;
            });

            res.json({
                success: true,
                data: {
                    overall: {
                        totalStudents,
                        enrolled: enrolledCount,
                        notEnrolled: totalStudents - enrolledCount,
                        enrollmentRate: totalStudents > 0
                            ? ((enrolledCount / totalStudents) * 100).toFixed(2)
                            : 0
                    },
                    attempts: {
                        studentsAttempted: studentsWithAttempts.length,
                        studentsNotAttempted: enrolledCount - studentsWithAttempts.length,
                        attemptRate: enrolledCount > 0
                            ? ((studentsWithAttempts.length / enrolledCount) * 100).toFixed(2)
                            : 0
                    },
                    demographics: {
                        byDepartment: Object.entries(departmentStats).map(([dept, count]) => ({
                            department: dept,
                            count
                        })),
                        bySemester: Object.entries(semesterStats).map(([sem, count]) => ({
                            semester: parseInt(sem),
                            count
                        })).sort((a, b) => a.semester - b.semester)
                    },
                    quiz: {
                        id: quiz._id,
                        title: quiz.title,
                        isPublished: quiz.isPublished
                    }
                }
            });
        } catch (error) {
            logger.error('Get enrollment statistics error:', error);
            if (error.message.includes('Access denied')) {
                return res.status(403).json({ success: false, error: error.message });
            }
            next(error);
        }
    }
}

module.exports = new QuizEnrollmentController();