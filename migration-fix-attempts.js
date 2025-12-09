// migration-fix-attempts.js
// Run this ONCE to fix existing attempts with empty selectedQuestions

const mongoose = require('mongoose');
const QuizAttempt = require('../backend/src/models/QuizAttempt');
const Question = require('../backend/src/models/Question');

async function fixExistingAttempts() {
    try {
        // Connect to database (adjust connection string)
        await mongoose.connect('mongodb+srv://gsb021_db_user:nxD4OoLgRHWZUxaH@cluster0.rd6u6lr.mongodb.net/quizAppDB?retryWrites=true&w=majority');

        console.log('Connected to database');

        // Find all attempts with empty selectedQuestions
        const brokenAttempts = await QuizAttempt.find({
            $or: [
                { selectedQuestions: { $exists: false } },
                { selectedQuestions: { $size: 0 } }
            ],
            status: 'in_progress'
        });

        console.log(`Found ${brokenAttempts.length} attempts to fix`);

        for (const attempt of brokenAttempts) {
            if (attempt.questionsServed && attempt.questionsServed.length > 0) {
                // Get all questions
                const questionIds = attempt.questionsServed.map(qs => qs.question);
                const questions = await Question.find({ _id: { $in: questionIds } });

                // Rebuild selectedQuestions
                attempt.selectedQuestions = attempt.questionsServed.map(qs => {
                    const question = questions.find(q => q._id.toString() === qs.question.toString());
                    
                    if (!question) {
                        console.warn(`Question ${qs.question} not found`);
                        return null;
                    }

                    return {
                        question: question._id,
                        prompt: question.prompt,
                        type: question.type,
                        marks: question.marks,
                        choices: question.choices.map(c => ({
                            id: c.id,
                            text: c.text
                        }))
                    };
                }).filter(Boolean); // Remove nulls

                await attempt.save();
                console.log(`Fixed attempt ${attempt._id}`);
            } else {
                console.warn(`Attempt ${attempt._id} has no questionsServed, cannot fix`);
            }
        }

        console.log('Migration complete!');
        await mongoose.connection.close();
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

// Run the migration
fixExistingAttempts();