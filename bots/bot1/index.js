const { Telegraf, Markup, session, Scenes } = require('telegraf');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const fetch = require('node-fetch');


require('dotenv').config();
const { pipeline } = require('stream/promises'); 


const authDB = require('./authDatabase'); 


const database = require('./database');
const connectWithRetry = database.connectWithRetry;


const User = database.User;
const Student = database.Student;
const Teacher = database.Teacher;
const TeacherLogin = database.TeacherLogin;
const TeacherStudent = database.TeacherStudent;
const Grade = database.Grade;
const Attendance = database.Attendance;
const OTP = database.OTP;
const StudentListRequest = database.StudentListRequest;
const FreelanceOffer = database.FreelanceOffer;
const TeacherSettings = database.TeacherSettings;
const UploadedFile = database.UploadedFile;
const BotState = database.BotState;
const ActivityLog = database.ActivityLog;
const Announcement = database.Announcement;
const ApprovalMessage = database.ApprovalMessage;
const ParentContact = database.ParentContact;








//
//
//
////
//
//
//
//

//helper Functions ****1*****
//
//
//
//
//
//


async function cleanAndNotifyAdminsForUnlinkDeny(ctx, requestId, student, parentUser, approverName) {
  try {
    const approval = await ApprovalMessage.findOne({ type: 'unlink_parent', requestId });
    const currentAdminId = ctx.from.id.toString();

    const isAmharic = parentUser?.role === 'parentAm';

    const notificationText = isAmharic
      ? `🚫 <b>Parent Unlink Denied!</b>\n\n` +
        `👤 Parent: <b>${parentUser.name || 'Unknown'}</b> (ID: ${parentUser.telegramId})\n` +
        `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
        `👤 Denied by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`
      : `🚫 <b>Parent Unlink Denied!</b>\n\n` +
        `👤 Parent: <b>${parentUser.name || 'Unknown'}</b> (ID: ${parentUser.telegramId})\n` +
        `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
        `👤 Denied by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`;

    if (typeof clearApprovalMessages === 'function') {
      await clearApprovalMessages('unlink_parent', requestId, true);
    } else if (approval) {
      for (const msg of approval.messages) {
        try {
          await ctx.telegram.deleteMessage(msg.adminId, msg.messageId);
        } catch (e) {
        }
      }
      await ApprovalMessage.deleteOne({ _id: approval._id });
    }

    if (approval && approval.messages?.length) {
      for (const msg of approval.messages) {
        if (String(msg.adminId) !== currentAdminId) {
          try {
            await ctx.telegram.sendMessage(msg.adminId, notificationText, { parse_mode: 'HTML' });
          } catch (err) {
            console.error(`Failed to notify admin ${msg.adminId}:`, err.message);
          }
        }
      }
    } else {
    }
  } catch (error) {
    console.error('Error in cleanAndNotifyAdminsForUnlinkDeny:', error);
  }
}

async function cleanAndNotifyAdminsForUnlink(ctx, requestId, student, parentUser, approverName) {
  try {
    const approval = await ApprovalMessage.findOne({ type: 'unlink_parent', requestId });
    const currentAdminId = ctx.from.id.toString();

    const isAmharic = parentUser?.role === 'parentAm';

    const notificationText = isAmharic
      ? `✅ <b>Parent Unlink Approved</b>\n\n` +
        `👤 Parent: <b>${parentUser.name || 'Unknown'}</b> (ID: ${parentUser.telegramId})\n` +
        `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
        `👤 Approved by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`
      : `✅ <b>Parent Unlink Approved</b>\n\n` +
        `👤 Parent: <b>${parentUser.name || 'Unknown'}</b> (ID: ${parentUser.telegramId})\n` +
        `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
        `👤 Approved by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`;

    if (typeof clearApprovalMessages === 'function') {
      await clearApprovalMessages('unlink_parent', requestId, true);
    } else if (approval) {
      for (const msg of approval.messages) {
        try {
          await ctx.telegram.deleteMessage(msg.adminId, msg.messageId);
        } catch (e) {
        }
      }
      await ApprovalMessage.deleteOne({ _id: approval._id });
    }

    if (approval && approval.messages?.length) {
      for (const msg of approval.messages) {
        if (String(msg.adminId) !== currentAdminId) {
          try {
            await ctx.telegram.sendMessage(msg.adminId, notificationText, { parse_mode: 'HTML' });
          } catch (err) {
            console.error(`Failed to notify admin ${msg.adminId}:`, err.message);
          }
        }
      }
    } else {
      console.log(`[INFO] No ApprovalMessage found for unlink ${requestId} (may be already handled).`);
    }
  } catch (error) {
    console.error('Error in cleanAndNotifyAdminsForUnlink:', error);
  }
}



async function cleanAndNotifyAdminsForParent(ctx, requestId, student, parentUser, approverName) {
    const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
    const currentAdminId = ctx.from.id;

    const notificationText =
        `✅ <b>PARENT LINK APPROVED</b>.\n\n` +
        `👤 Parent: <b>${parentUser.name || 'Unknown'}</b> (ID: ${parentUser.telegramId})\n` +
        `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
        `👤 Approved by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString()}`;

    if (typeof clearApprovalMessages === 'function') {
        await clearApprovalMessages('parent', requestId, true); 
    }

    if (approval) {
        for (const msg of approval.messages) {
            if (msg.adminId !== currentAdminId) {
                try {
                    await ctx.telegram.sendMessage(
                        msg.adminId,
                        notificationText,
                        { parse_mode: 'HTML' }
                    );
                } catch (err) {
                    console.error(`Failed to notify admin ${msg.adminId}:`, err.message);
                }
            }
        }
    } else {
        console.log(`[INFO] ApprovalMessage for ${requestId} not found for notification pass (concurrency).`);
    }
}


async function clearOtherPendingParentRequests(ctx, parent, deniedStudentId, admin) {
    const otherPendingRequests = (parent.pendingStudentRequests || []).filter(
        (r) => r.studentId !== deniedStudentId
    );

    if (otherPendingRequests.length === 0) {
    }

    const adminName = admin.name || ctx.from.first_name || 'Admin';
    const parentId = parent.telegramId;

    for (const req of otherPendingRequests) {
        const otherStudentId = req.studentId;
        const requestId = `${parentId}_${otherStudentId}`;
        
        const otherStudent = await getStudentById(otherStudentId);
        const studentName = otherStudent ? otherStudent.name : otherStudentId;

        if (otherStudent && otherStudent.pendingParentId === parentId) {
            otherStudent.pendingParentId = null;
            otherStudent.pendingParentAt = null;
            await otherStudent.save();
        }
        
        const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
        
        if (approval) {
            const parentCancellationText =
                `🚫 <b>REQUEST CANCELLED</b> (Auto-Denied)\n\n` +
                `Your request to link with student <b>${studentName}</b> (ID: <code>${otherStudentId}</code>) ` +
                `was automatically cancelled because another of your link requests was denied by an administrator.`;
            
            try {
                await ctx.telegram.sendMessage(parentId, parentCancellationText, { parse_mode: 'HTML' });
            } catch (error) {
                console.error(`Failed to notify parent ${parentId} about cancellation of ${otherStudentId}:`, error);
            }

            const adminCancellationText =
                `🚫 <b>REQUEST CANCELLED</b> (Auto-Denied)\n\n` +
                `👤 Parent: <b>${parent.name}</b> (ID: ${parentId})\n` +
                `🎓 Student: <b>${studentName}</b> (${otherStudentId})\n\n` +
                `Note: Another request from this parent was denied by <b>${adminName}</b>.`;

            for (const msg of approval.messages) {
                try {
                    await ctx.telegram.editMessageReplyMarkup(
                        msg.adminId,
                        msg.messageId,
                        null,
                        { inline_keyboard: [] }
                    );
                    if (msg.adminId !== ctx.from.id) {
                        await ctx.telegram.sendMessage(msg.adminId, adminCancellationText, { parse_mode: 'HTML' });
                    }
                } catch (err) {
                    console.error(`Failed to notify/edit admin ${msg.adminId} for cancelled request:`, err.message);
                }
            }
            
            await ApprovalMessage.deleteOne({ _id: approval._id });

            await logAdminAction(ctx, 'AUTO_DENY_PARENT_REQUEST', {
                parentId: parentId,
                parentName: parent.name,
                studentId: otherStudentId,
                studentName: studentName,
                reason: 'Another request was denied',
                deniedBy: admin.telegramId,
            });
        }
    }

    parent.pendingStudentRequests = []; 
    await parent.save();
}



async function removeMessageAcrossBot(type, requestId, deleteMessage = false) {
  try {
    const record = await ApprovalMessage.findOne({ type, requestId });
    if (!record || !record.messages || record.messages.length === 0) {
      console.warn(`⚠️ No messages found for ${type}/${requestId}`);
      return;
    }

    for (const msg of record.messages) {
      try {
        if (deleteMessage) {
          await bot.telegram.deleteMessage(msg.adminId, msg.messageId);
        } else {
          await bot.telegram.editMessageReplyMarkup(msg.adminId, msg.messageId, null, { inline_keyboard: [] });
        }
      } catch (err) {
        if (err.description?.includes('message is not modified') || err.description?.includes('message to delete not found')) {
          continue; 
        }
        console.warn(`⚠️ Failed to update message ${msg.messageId} in chat ${msg.adminId}:`, err.description);
      }
    }

    await ApprovalMessage.deleteOne({ type, requestId });
  } catch (err) {
    console.error(`🛑 Error removing messages for ${type}/${requestId}:`, err);
  }
}



async function broadcastWithTracking(type, requestId, recipients, message, keyboard) {
  const messages = [];

  for (const user of recipients) {
    try {
      const sent = await bot.telegram.sendMessage(user.telegramId, message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: keyboard },
      });
      messages.push({ adminId: user.telegramId, messageId: sent.message_id });
    } catch (err) {
      console.error(`Failed to send to ${user.telegramId}:`, err.description);
    }
  }

  if (messages.length > 0) {
    await ApprovalMessage.create({ type, requestId, messages });
  }
}



async function clearApprovalMessages(type, requestId, deleteInstead = false) {
  try {
    const approval = await ApprovalMessage.findOne({ type, requestId });
    if (!approval) return;

    for (const msg of approval.messages) {
      try {
        if (deleteInstead) {
          await bot.telegram.deleteMessage(msg.adminId, msg.messageId);
        } else {
          await bot.telegram.editMessageReplyMarkup(
            msg.adminId,
            msg.messageId,
            null,
            { reply_markup: { inline_keyboard: [] } }
          );
        }
      } catch (error) {
        const desc = error.response?.description || error.message || '';
        const code = error.response?.error_code;

        if (
          code === 400 &&
          (
            desc.includes('message to delete not found') ||
            desc.includes('message can\'t be deleted') ||
            desc.includes('message is not modified') ||
            desc.includes('message not found') ||
            desc.includes('message identifier is not specified')
          )
        ) {
          continue;
        }

        if (code === 403 && desc.includes('bot was kicked')) {
          continue;
        }

        console.warn(
          `⚠️ clearApprovalMessages: failed on chat ${msg.adminId}, message ${msg.messageId}:`,
          `${code || ''} ${desc}`
        );
      }
    }

    await ApprovalMessage.deleteOne({ _id: approval._id });
  } catch (error) {
    console.error(`🛑 Error clearing approval messages for ${type}/${requestId}:`, error);
  }
}





async function displayStudentGrades(ctx, student) {
    try {
        const result = await viewStudentGrades(student.studentId);
        let message = `<b>📋 Grades for ${student.name} (Class: ${student.class || 'N/A'})</b>\n\n`;

        if (!result || result.grades.length === 0) {
            message += 'ℹ️ No grades recorded yet.\n';
            return ctx.replyWithHTML(message);
        }

        const gradesBySubject = {};
        result.grades.forEach(grade => {
            if (!gradesBySubject[grade.subject]) {
                gradesBySubject[grade.subject] = [];
            }
            gradesBySubject[grade.subject].push(grade);
        });

        for (const [subject, grades] of Object.entries(gradesBySubject)) {
            const average = grades.reduce((sum, g) => sum + g.score, 0) / grades.length;
            message += `<b>${subject}</b>\n`;
            
            grades.slice(0, 5).forEach(grade => {
                const date = new Date(grade.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                message += `  \n• ${grade.score} -------- ${grade.purpose} (${date})\n`;
            });

            if (grades.length > 5) {
                message += `  ...and ${grades.length - 5} more grades. `;
                message += `<a href="#">View all</a>\n`; 
            }
            message += '\n';
        }

        const students = await getStudentsByParentId(ctx.from.id);
        const backButton = students.length > 1 
            ? Markup.inlineKeyboard([Markup.button.callback('🔙 Back to Students', 'view_grades')])
            : null;

        return ctx.replyWithHTML(message, backButton);
    } catch (error) {
        console.error(`Error fetching grades for student ${student.studentId}:`, error);
        return ctx.reply('⚠️ An error occurred while retrieving grades. Please try again.');
    }
}


async function checkBotState() {
    const state = await BotState.findOne({});
    if (!state) {
        const newState = new BotState({ state: 'running' });
        await newState.save();
        return true;
    }
    return state.state === 'running';
}





const setupAttendanceReminders = () => {
    setInterval(async () => {
        try {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const settings = await TeacherSettings.find({ 
                attendanceReminder: true,
                reminderTime: currentTime
            });
            
            for (const setting of settings) {
                const teacher = await Teacher.findOne({ teacherId: setting.teacherId });
                if (teacher && teacher.telegramId) {
                    try {
                        await bot.telegram.sendMessage(
                            teacher.telegramId,
                            `🔔 Daily Attendance Reminder\n\n` +
                            `It's time to take attendance for your classes today!\n\n` +
                            `Use the "📝 Record Attendance" option in your teacher menu to record attendance for your subjects.`,
                            { parse_mode: "HTML" }
                        );
                    } catch (error) {
                        console.error(`Failed to send reminder to teacher ${teacher.teacherId}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error('Error in attendance reminder system:', error);
        }
    }, 60000); 
};

setupAttendanceReminders();

const generateUniqueAttendanceId = async () => {
    let attendanceId;
    let exists;
    do {
        const randomDigits = crypto.randomInt(1000, 9999).toString();
        attendanceId = `AT${randomDigits}`;
        exists = await Attendance.findOne({ attendanceId });
    } while (exists);
    return attendanceId;
};

const isUserRegisteredTeacher = async (telegramId) => {
    try {
        const teacher = await Teacher.findOne({ telegramId });
        return teacher !== null;
    } catch (error) {
        console.error('Error checking teacher registration:', error);
        return false;
    }
};


const getRichTeacherInfo = async (telegramId) => {
    try {
        const teacher = await Teacher.findOne({ telegramId });
        if (!teacher) return null;

        const subjectStats = await TeacherStudent.aggregate([
            { $match: { teacherId: teacher.teacherId } },
            { $group: {
                _id: '$subject',
                studentCount: { $sum: 1 }
            }},
            { $sort: { studentCount: -1 } }
        ]);

        const studentCount = subjectStats.reduce((sum, stat) => sum + stat.studentCount, 0);

        return {
            name: teacher.name,
            teacherId: teacher.teacherId,
            telegramId: teacher.telegramId,
            username: teacher.username,
            subjects: teacher.subjects || [],
            subjectStats: subjectStats,
            studentCount: studentCount,
            registrationDate: teacher.createdAt
        };
    } catch (error) {
        console.error('Error getting rich teacher info:', error);
        return null;
    }
};
const getFormattedListInfo = async (teacherId, className) => {
    const listInfo = await TeacherStudent.aggregate([
        { $match: { teacherId: teacherId, className: className } },
        { $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            subjects: { $addToSet: '$subject' },
            firstAdded: { $min: '$addedDate' },
            lastAdded: { $max: '$addedDate' },
            studentNames: { $push: '$studentName' }
        }}
    ]);

    if (!Array.isArray(listInfo) || listInfo.length === 0 || !listInfo[0]) return null;

    const group = listInfo[0];

    return {
        totalStudents: group.totalStudents || 0,
        subjects: group.subjects || [],
        subjectCount: (group.subjects || []).length,
        firstAdded: group.firstAdded || null,
        lastAdded: group.lastAdded || null,
        sampleStudents: (group.studentNames || []).slice(0, 5) 
    };
};
const getUniqueClasses = async () => {
    try {
        const classes = await Student.distinct('class');
        return classes.filter(className => className && className.trim() !== '');
    } catch (err) {
        console.error('Error getting unique classes:', err);
        return [];
    }
};

const processTeacherStudentUpload = async (ctx, studentIds, subject) => {
    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (!teacher) {
        return ctx.reply('🛑 Teacher profile not found. Please contact an admin.');
    }

    const { teacherId, name: teacherName } = teacher;
    let successfulCreations = 0;
    let failedCreations = 0;
    const failedStudents = [];

    for (const studentId of studentIds) {
        try {
            const student = await Student.findOne({ studentId });
            if (student) {
                const existingRelation = await TeacherStudent.findOne({
                    teacherId,
                    studentId,
                    subject
                });

                if (!existingRelation) {
                    const newRelation = new TeacherStudent({
                        teacherId,
                        teacherName,
                        studentId,
                        studentName: student.name,
                        subject,
                        className: student.class
                    });
                    await newRelation.save();
                    successfulCreations++;
                } else {
                    successfulCreations++;
                }
            } else {
                failedCreations++;
                failedStudents.push(studentId);
            }
        } catch (error) {
            if (error.code === 11000) { 
                successfulCreations++;
            } else {
                console.error(`Error creating relationship for student ${studentId}:`, error);
                failedCreations++;
                failedStudents.push(studentId);
            }
        }
    }

    let replyMessage = `✅ Finished processing student list.\n\n`;
    replyMessage += `• Successful links created: ${successfulCreations}\n`;
    replyMessage += `• Failed to link (student ID not found): ${failedCreations}\n`;

    if (failedStudents.length > 0) {
        replyMessage += `\n🛑 The following IDs could not be found:\n`;
        replyMessage += failedStudents.join(', ');
    }

    ctx.reply(replyMessage);
    ctx.scene.leave();
};




const getUserByUsername = async (username) => {
    try {
        return await User.findOne({ 
            name: new RegExp(`^${username}$`, 'i')
        });
    } catch (err) {
        console.error('Error getting user by username:', err);
        return null;
    }
};


// --- Bot Initialization ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Input Validation Functions ---
const isValidStudentId = (id) => {
    return /^ST-?\d{4}$/i.test(id);
};

const isValidTeacherId = (id) => /^TE\d{4}$/.test(id);
const isValidAdminId = (id) => /^AD\d{2}$/.test(id);

const isValidTelegramId = (id) => /^\d+$/.test(id);
const isValidName = (name) => name && name.trim().length > 0 && name.trim().length <= 100;
const isValidClassName = (className) => className && className.trim().length > 0 && className.trim().length <= 50;
const isValidSubject = (subject) => subject && subject.trim().length > 0 && subject.trim().length <= 50;


const isValidAnnouncementOrMessage = (text) => text && text.trim().length > 0;



// --- Helper Functions ---
//
//
//
//
//
//
//
//
// 


const TELEGRAM_BROADCAST_DELAY_MS = 10; // .001 second delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const getUserById = async (telegramId) => {
    try {
        return await User.findOne({ telegramId });
    } catch (err) {
        console.error('Error getting user by ID:', err);
        return null;
    }
};

const getStudentById = async (studentId) => {
    try {
        return await Student.findOne({ studentId });
    } catch (err) {
        console.error('Error getting student by ID:', err);
        return null;
    }
};

const getStudentsByParentId = async (parentId) => {
    try {
        return await Student.find({ parentId });
    } catch (err) {
        console.error('Error getting students by parent ID:', err);
        return [];
    }
};

const getTeacherById = async (teacherId) => {
    try {
        return await Teacher.findOne({ teacherId });
    } catch (err) {
        console.error('Error getting teacher by ID:', err);
        return null;
    }
};

const getAdmins = async () => {
    try {
        return await User.find({ role: 'admin' });
    } catch (err) {
        console.error('Error getting admins:', err);
        return [];
    }
};


function getTelegramIdFromCtx(ctx) {
  const raw = ctx?.from?.id;
  return raw !== undefined && raw !== null ? String(raw) : null;
}

function isAdminUser(user) {
  if (!user) return false;
  const role = (user.role || '').toString().toLowerCase();
  return role === 'admin' || role === 'master_admin' || !!user.masterAdmin;
}





const generateClassDeletionLog = (className, deletedStudents, unlinkedParents, deletedTeacherRelations, studentDetails, parentDetails, teacherRelations, adminInfo) => {
    let logContent = `CLASS DELETION REPORT\n`;
    logContent += '='.repeat(80) + '\n\n';
    logContent += `Class: ${className}\n`;
    logContent += `Deleted by: ${adminInfo.first_name || 'Admin'} ${adminInfo.last_name || ''} (ID: ${adminInfo.id})\n`;
    logContent += `Timestamp: ${new Date().toLocaleString()}\n`;
    logContent += '='.repeat(80) + '\n\n';
    
    logContent += 'SUMMARY:\n';
    logContent += '='.repeat(80) + '\n';
    logContent += `Total Students Deleted: ${deletedStudents}\n`;
    logContent += `Parents Unlinked: ${unlinkedParents}\n`;
    logContent += `Teacher Relationships Removed: ${deletedTeacherRelations}\n\n`;
    
    logContent += 'STUDENTS DELETED:\n';
    logContent += '='.repeat(80) + '\n';
    studentDetails.forEach((student, index) => {
        logContent += `${index + 1}. ${student.studentName} (ID: ${student.studentId})\n`;
    });
    if (studentDetails.length === 0) {
        logContent += 'No students found in this class.\n';
    }
    logContent += '\n';
    
    logContent += 'PARENTS UNLINKED:\n';
    logContent += '='.repeat(80) + '\n';
    parentDetails.forEach((parent, index) => {
        logContent += `${index + 1}. ${parent.parentName} (ID: ${parent.parentId}) - Student: ${parent.studentId}\n`;
    });
    if (parentDetails.length === 0) {
        logContent += 'No parents were linked to students in this class.\n';
    }
    logContent += '\n';
    
    logContent += 'TEACHER RELATIONSHIPS REMOVED:\n';
    logContent += '='.repeat(80) + '\n';
    teacherRelations.slice(0, 20).forEach((relation, index) => {
        logContent += `${index + 1}. ${relation.teacherName} (${relation.teacherId}) -> ${relation.studentName} (${relation.studentId}) - ${relation.subject}\n`;
    });
    if (teacherRelations.length > 20) {
        logContent += `... and ${teacherRelations.length - 20} more relationships\n`;
    }
    if (teacherRelations.length === 0) {
        logContent += 'No teacher relationships found for this class.\n';
    }
    
    return logContent;
};
const notifyMasterAdmin = async (ctx, action, details = {}, messageId = null) => {
    try {
        const masterAdminId = process.env.MASTER_ADMIN_ID;
        if (!masterAdminId) return null;

        const admin = ctx.from ? await getUserById(ctx.from.id) : null;
        const adminInfo = admin ? `${admin.name} (ID: ${admin.telegramId})` : 'Unknown';

        let message = `🔍 <b>Admin Action Alert</b>\n\n`;
        message += `👤 <b>Admin:</b> ${adminInfo}\n`;
        message += `⏰ <b>Time:</b> ${new Date().toLocaleString()}\n`;
        message += `🔧 <b>Action:</b> ${action}\n`;

        if (details) {
            if (details.className) {
                message += `🏫 <b>Class:</b> ${details.className}\n`;
            }
            if (details.progress !== undefined && details.total !== undefined) {
                message += `📊 <b>Progress:</b> ${details.progress}/${details.total} (${details.percentage}%)\n`;
            }
            if (details.teacherId && details.teacherName) {
    message += `👩‍🏫 <b>Teacher:</b> ${details.teacherName} (ID: ${details.teacherId})\n`;
}

            if (details.eta) {
                message += `⏰ <b>ETA:</b> ${details.eta}\n`;
            }
            if (details.speed) {
                message += `🏎️ <b>Speed:</b> ${details.speed} students/sec\n`;
            }
            if (details.statistics) {
                message += `📈 <b>Results:</b> ${details.statistics.deletedStudents} students, ` +
                          `${details.statistics.unlinkedParents} parents, ` +
                          `${details.statistics.deletedTeacherRelations} teacher relations\n`;
            }
            if (details.totalTime) {
                message += `⏱️ <b>Total Time:</b> ${details.totalTime}\n`;
            }
            
            if (details.messageText) {
                message += `💬 <b>Message:</b> ${details.messageText.substring(0, 100)}...\n`;
            }
            if (details.command) {
                message += `🔧 <b>Command:</b> ${details.command}\n`;
            }
            if (details.removedAdmin) {
                message += `🗑️ <b>Removed Admin:</b> ${details.removedAdmin}\n`;
            }
            if (details.promotedUser) {
                message += `👑 <b>Promoted User:</b> ${details.promotedUser}\n`;
            }
            if (details.chatType) {
                message += `💬 <b>Chat Type:</b> ${details.chatType}\n`;
            }
            if (details.uploadedFile) {
                message += `📤 <b>Uploaded:</b> ${details.uploadedFile.name} (Class: ${details.uploadedFile.class})\n`;
            }
            if (details.removedFileId) {
                message += `🗑️ <b>Removed File ID:</b> ${details.removedFileId}\n`;
            }
            if (details.model) {
                message += `⚙️ <b>DB Change:</b> ${details.model}.${details.operation} (Target: ${details.targetId})\n`;
            }
            if (details.error) {
                message += `🛑 <b>Error:</b> ${details.error}\n`;
            }
        }

        if (messageId) {
            try {
                return await bot.telegram.editMessageText(
                    masterAdminId,
                    messageId,
                    null,
                    message,
                    { parse_mode: 'HTML' }
                );
            } catch (editError) {
                console.log('Cannot edit message, sending new one:', editError.message);
            }
        }

        return await bot.telegram.sendMessage(masterAdminId, message, { 
            parse_mode: 'HTML' 
        });

    } catch (error) {
        console.error('Error notifying master admin:', error);
        return null;
    }
};
const requireMasterAdmin = async (ctx, next) => {
    try {
        const masterAdminId = process.env.MASTER_ADMIN_ID;
        
        if (!masterAdminId) {
            ctx.reply('🛑 Master admin system not configured.');
            return;
        }

        if (ctx.from.id.toString() !== masterAdminId) {
            ctx.reply('🛑 Access denied. Master admin privileges required.');
            return;
        }

        let masterAdminUser = await User.findOne({ telegramId: masterAdminId });
        if (!masterAdminUser) {
            masterAdminUser = new User({
                telegramId: masterAdminId,
                name: ctx.from.first_name || 'Master Admin',
                role: 'admin',
                masterAdmin: true
            });
            await masterAdminUser.save();
        } else if (!masterAdminUser.masterAdmin) {
            masterAdminUser.masterAdmin = true;
            masterAdminUser.role = 'admin';
            await masterAdminUser.save();
        }

        if (ctx.message && ctx.message.text) {
            const restrictedRoles = ['teacher', 'parent', 'user'];

            if (restrictedRoles.some(r => ctx.message.text.toLowerCase().includes(r))) {
                ctx.reply('🛑 Master admins can only manage admins. Requests from teachers, parents, or users are not accepted.');
                return;
            }
        }

        ctx.state.masterAdmin = masterAdminUser;
        return next();

    } catch (error) {
        console.error('Master admin auth error:', error);
        ctx.reply('🛑 Authorization error. Please try again.');
    }
};

const getLoginMenu = async (telegramId) => {
    const user = await getUserById(telegramId);
    if (user) {
        switch (user.role) {
            case 'teacher':
                return postLogoutMenu;
            case 'admin':
                return adminMenu;
            case 'parent':
                return parentMenu;
            default:
                return loginMenu;
        }
    }
    return loginMenu;
};
const requireTeacherAuth = async (ctx, next) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (teacher.banned) {
    ctx.reply('Info : Your access has been banned. Please contact an administrator.');
    return;
  }

        if (teacher) {
            const user = await getUserById(ctx.from.id);
            if (user && user.role === 'teacher') {
                ctx.state.teacher = teacher;
                return next();
            } else {
                if (user) {
                    user.role = 'teacher';
                    await user.save();
                    ctx.state.teacher = teacher;
                    return next();
                }
            }
        }
        
        ctx.reply('🛑 You are not registered as a teacher yet. Please use the "👨‍🏫 Teacher Registration" option first.', loginMenu);
        
    } catch (error) {
        console.error('Authorization error:', error);
        ctx.reply('🛑 An error occurred during authorization. Please try again.');
    }
};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generatePassword = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const isOTPExpired = (expiresAt) => {
    return new Date() > expiresAt;
};

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

const verifyPassword = (password, hashedPassword) => {
    return hashPassword(password) === hashedPassword;
};

const isAccountLocked = (lockedUntil) => {
    return lockedUntil && new Date() < lockedUntil;
};

const viewStudentGrades = async (studentId, subject = null) => {
    try {
        const student = await getStudentById(studentId);
        if (!student) return null;
        
        const grades = await getStudentGrades(studentId, subject);
        
        return {
            student: student.name,
            studentId: student.studentId,
            class: student.class,
            grades: grades.map(grade => ({
                subject: grade.subject,
                score: grade.score,
                purpose: grade.purpose,
                date: grade.date,
                comments: grade.comments,
                teacher: grade.teacherName
            }))
        };
    } catch (error) {
        console.error('Error viewing student grades:', error);
        return null;
    }
};
const getStudentsByTeacherAndSubject = async (teacherId, subject) => {
    try {
        return await TeacherStudent.find({ 
            teacherId, 
            subject 
        }).sort({ studentName: 1 }); 
    } catch (err) {
        console.error('Error getting students by teacher and subject:', err);
        return [];
    }
};

const getStudentGrades = async (studentId, subject = null) => {
    try {
        const query = { studentId };
        if (subject) query.subject = subject;
        return await Grade.find(query).sort({ date: -1 });
    } catch (err) {
        console.error('Error getting student grades:', err);
        return [];
    }
};

const generateUniqueGradeId = async () => {
    let gradeId;
    let exists;
    do {
        const randomDigits = crypto.randomInt(1000, 9999).toString();
        gradeId = `GR${randomDigits}`;
        exists = await Grade.findOne({ gradeId });
    } while (exists);
    return gradeId;
};

const generateUniqueStudentId = async () => {
    let studentId;
    let exists;
    do {
        const randomDigits = crypto.randomInt(1000, 9999).toString();
        studentId = `ST${randomDigits}`;
        exists = await Student.findOne({ studentId });
    } while (exists);
    return studentId;
};

const generateUniqueTeacherId = async () => {
    let teacherId;
    let exists;
    do {
        const randomDigits = crypto.randomInt(1000, 9999).toString();
        teacherId = `TE${randomDigits}`;
        exists = await Teacher.findOne({ teacherId });
    } while (exists);
    return teacherId;
};

const generateUniqueAdminId = async () => {
    let adminId;
    let exists;
    do {
        const randomDigits = crypto.randomInt(10, 99).toString();
        adminId = `AD${randomDigits}`;
        exists = await User.findOne({ adminId }); 
    } while (exists);
    return adminId;
};



// --- Stage Management ---
const { leave } = Scenes.Stage;
const stage = new Scenes.Stage();




async function logAdminAction(ctx, action, details = {}) {
  try {
    const user = await User.findOne({ telegramId: String(ctx.from.id) });

    const logEntry = {
      action,
      details,
      adminId: String(ctx.from.id),
      adminName:
        user?.name ||
        ctx.from.username ||
        `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() ||
        'Unknown Admin',
      timestamp: new Date()
    };


    await ActivityLog.create(logEntry);

    const logFilePath = path.join(process.cwd(), 'activity.log');

    let detailsFormatted = '📄 Details: None';
    if (details && Object.keys(details).length > 0) {
      detailsFormatted = '📄 Details:\n';
      for (const [key, value] of Object.entries(details)) {
        detailsFormatted += `   • ${key}: ${value}\n`;
      }
    }

    const logLine =
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🕒 Time: ${logEntry.timestamp.toLocaleString()}\n` +
      `👤 Admin: ${logEntry.adminName} (${logEntry.adminId})\n` +
      `🔧 Action: ${logEntry.action}\n` +
      `${detailsFormatted}` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    try {
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (err) {
      console.error("🛑 Failed to write activity.log:", err);
    }

    const notifyActions = [
      'DELETE_CLASS',
      'REMOVE_STUDENT',
      'UPLOAD_DOCUMENT',
      'APPROVE_PARENT'
    ];
    if (notifyActions.includes(action)) {
      const notifyMessage =
        `📢 <b>Admin Activity Alert</b>\n\n` +
        `🕒 <b>Time:</b> ${logEntry.timestamp.toLocaleString()}\n` +
        `👤 <b>Admin:</b> ${logEntry.adminName} (${logEntry.adminId})\n` +
        `🔧 <b>Action:</b> ${logEntry.action}\n` +
        (details && Object.keys(details).length > 0
          ? `📄 <b>Details:</b>\n` +
            Object.entries(details).map(([k, v]) => `   • ${k}: ${v}`).join('\n')
          : `📄 <b>Details:</b> None`);

      await notifyMasterAdmin(ctx, action, { formatted: notifyMessage });
    }

  } catch (err) {
    console.error('🛑 Failed to log admin action:', err);
  }
}

module.exports = { logAdminAction };










bot.use(session());
bot.use(stage.middleware());
//
//
//
//
//
//
//
// --- Scene Definitions --------------------------------------
//
//
//
//
//
//
//
//
//
//
//
//
///
//
///



//*******************broadcasting Ad */

const broadcastScene = new Scenes.BaseScene('broadcastScene');


const cancelKeyboard0 = Markup.keyboard([
  ['🛑 Cancel']
]).resize();
broadcastScene.enter(async (ctx) => {
    ctx.session.broadcast = {
        step: 'target',
        role: null,
        message: null
    };


    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('👨‍👩‍👧 All Parents', 'target_parent')],
        [Markup.button.callback('👩‍🏫 All Teachers', 'target_teacher')],
        [Markup.button.callback('💻 All Admins', 'target_admin')],
        [Markup.button.callback('🔙 Cancel', 'broadcast_cancel')]
    ]);
    
    if (ctx.callbackQuery) {
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    }
    
    await ctx.reply('Who would you like to broadcast this message to?', keyboard);
    ctx.reply('...', cancelKeyboard0);
});

broadcastScene.hears('🛑 Cancel', async (ctx) => {
  await ctx.reply('🛑 Broadcast cancelled. Returning to menu...', masterAdminMenu);
  delete ctx.session.broadcast;
  return ctx.scene.leave();
});

broadcastScene.action(/target_(parent|teacher|admin)/, async (ctx) => {
    const role = ctx.match[1];
    ctx.session.broadcast.role = role;
    ctx.session.broadcast.step = 'message'; // Move to next state

    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
    await ctx.reply('Please send the **message or media** (photo, video, etc.) you want to broadcast. The first one received will be used.');
    
    return ctx.answerCbQuery();
});

broadcastScene.action('broadcast_cancel', async (ctx) => {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await ctx.reply('Broadcast cancelled.');
    return ctx.scene.leave();
});

broadcastScene.on(['text', 'photo', 'video', 'document', 'animation'], async (ctx) => {
    if (ctx.session.broadcast && ctx.session.broadcast.step === 'message') {
        
        ctx.session.broadcast.message = ctx.message;
        ctx.session.broadcast.step = 'confirm'; // Move to next state

        const targetName = ctx.session.broadcast.role.charAt(0).toUpperCase() + ctx.session.broadcast.role.slice(1) + 's';
        
        const confirmKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm & Send', 'broadcast_confirm')],
            [Markup.button.callback('❌ Cancel', 'broadcast_cancel')]
        ]);

        await ctx.replyWithHTML(
            `You are about to broadcast this message to **${targetName}**.\n\n` +
            `**Are you sure you want to send this?** (This cannot be undone.)`,
            confirmKeyboard
        );
        return;
    }
    if (ctx.session.broadcast && ctx.session.broadcast.step === 'confirm') {
         await ctx.reply('Please use the confirmation buttons.');
    }
});
const sentTelegramIds = new Set();

broadcastScene.action('broadcast_confirm', async (ctx) => {
  if (ctx.session.broadcast && ctx.session.broadcast.step === 'confirm') {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id).catch(() => {});
    await ctx.reply('🚀 Starting broadcast. This may take a while...');

    const { role: targetRole, message } = ctx.session.broadcast;
    let successCount = 0;
    let failCount = 0;

    try {
      let users = [];
      if (targetRole === 'parent') {
        users = await User.find({
          role: { $in: ['parent', 'parentAm'] },
          telegramId: { $ne: null }
        });
      } else {
        users = await User.find({
          role: targetRole,
          telegramId: { $ne: null }
        });
      }

      if (!users || users.length === 0) {
        await ctx.reply(`⚠️ No users found with role "${targetRole}".`);
        return ctx.scene.leave();
      }

      const seenThisRole = new Set();
      const uniqueUsers = users.filter(user => {
        const id = String(user.telegramId);
        if (seenThisRole.has(id)) return false;
        seenThisRole.add(id);
        return true;
      });

      for (const user of uniqueUsers) {
        const userId = String(user.telegramId);
        if (sentTelegramIds.has(userId)) {
          continue;
        }

        try {
          const options = { caption: message.caption, parse_mode: 'HTML' };

          if (message.photo) {
            await ctx.telegram.sendPhoto(userId, message.photo[0].file_id, options);
          } else if (message.video) {
            await ctx.telegram.sendVideo(userId, message.video.file_id, options);
          } else if (message.text) {
            await ctx.telegram.sendMessage(userId, message.text, { parse_mode: 'HTML' });
          } else if (message.document) {
            await ctx.telegram.sendDocument(userId, message.document.file_id, options);
          } else if (message.animation) {
            await ctx.telegram.sendAnimation(userId, message.animation.file_id, options);
          }

          sentTelegramIds.add(userId);
          successCount++;
          await sleep(TELEGRAM_BROADCAST_DELAY_MS);
        } catch (sendError) {
          failCount++;
          console.error(`Failed to send to user ${userId}: ${sendError.message}`);
        }
      }

      await ctx.reply(
        `✅ Broadcast Complete!\n\n` +
        `Target Role: ${targetRole.toUpperCase()}\n` +
        `Unique Recipients (this role): ${uniqueUsers.length}\n` +
        `Successful Sends: ${successCount}\n` +
        `Failed Sends: ${failCount}`
      );

    } catch (dbError) {
      console.error('Error fetching users for broadcast:', dbError);
      await ctx.reply('❌ Internal error while fetching users.');
    }

    delete ctx.session.broadcast;
    return ctx.scene.leave();
  }
});


stage.register(broadcastScene);



const PARENT_CONTACT_DAYS = (process.env.PARENT_CONTACT_DAYS || 'Mon,Tue,Wed,Thu,Fri').split(',').map(d => d.trim());
const PARENT_CONTACTS_PER_DAY = parseInt(process.env.PARENT_CONTACTS_PER_DAY || '1', 10);
const CONTACT_RESET_HOUR = parseInt(process.env.CONTACT_RESET_HOUR || '8', 10);
const CONTACT_TIMEZONE = 'Africa/Addis_Ababa'; // local timezone to evaluate day boundary

function getContactDayKey(date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: CONTACT_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit'
  });
  const parts = dtf.formatToParts(date).reduce((acc, p) => {
    if (p.type && p.value) acc[p.type] = p.value;
    return acc;
  }, {});
  let year = parseInt(parts.year, 10);
  let month = parseInt(parts.month, 10);
  let day = parseInt(parts.day, 10);
  let hour = parseInt(parts.hour, 10);

  if (hour < CONTACT_RESET_HOUR) {
    const utcMillis = date.getTime() - ( (new Date()).getTimezoneOffset() * 60000 );
    const adjusted = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    const dtf2 = new Intl.DateTimeFormat('en-GB', {
      timeZone: CONTACT_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts2 = dtf2.formatToParts(adjusted).reduce((acc, p) => { if (p.type && p.value) acc[p.type] = p.value; return acc; }, {});
    year = parseInt(parts2.year, 10);
    month = parseInt(parts2.month, 10);
    day = parseInt(parts2.day, 10);
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function getContactWeekdayShort(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: CONTACT_TIMEZONE, weekday: 'short' }).format(date);
}

// contact teacher scene for parents
const contactTeachersScene = new Scenes.BaseScene('contact_teachers_scene');

contactTeachersScene.enter(async (ctx) => {
  try {
    const parentTelegramId = String(ctx.from.id);
    const students = await getStudentsByParentId(parentTelegramId);
    if (!students || students.length === 0) {
      await ctx.reply('🛑 You have no students linked to your account. Please link a student first or contact an admin.', parentMenu);
      return ctx.scene.leave();
    }

    const studentIds = students.map(s => s.studentId);
    const relations = await TeacherStudent.find({}).then(all => all.filter(r => studentIds.includes(r.studentId)));
    const teacherIdSet = new Set(relations.map(r => String(r.teacherId)));
    if (teacherIdSet.size === 0) {
      await ctx.reply('🛑 No teachers found for your linked student(s).', parentMenu);
      return ctx.scene.leave();
    }

    const teacherButtons = [];
    for (const tId of teacherIdSet) {
      const teacher = await Teacher.findOne({ teacherId: tId });
      if (teacher && teacher.telegramId) {
        const label = `${teacher.name || teacher.username || 'Teacher'}${teacher.teacherId ? ` (${teacher.teacherId})` : ''}`;
        teacherButtons.push([ Markup.button.callback(label, `select_teacher_${teacher.telegramId}`) ]);
      }
    }

    if (teacherButtons.length === 0) {
      await ctx.reply('🛑 No available teachers with Telegram accounts found for your students.', parentMenu);
      return ctx.scene.leave();
    }

    teacherButtons.push([ Markup.button.callback('🛑 Cancel', 'cancel_contact_teacher') ]);
    await ctx.reply('👩‍🏫 Select the teacher you want to contact (you can send text or any media):', Markup.inlineKeyboard(teacherButtons));

    await ctx.reply('🔒 After selecting a teacher, send your message or attach media. Press Cancel to exit.', Markup.keyboard([['🛑 Cancel']]).resize());
  } catch (err) {
    console.error('contactTeachersScene.enter error:', err);
    await ctx.reply('🛑 Failed to load teachers. Please try again later.');
    return ctx.scene.leave();
  }
});

contactTeachersScene.action(/^select_teacher_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const teacherTelegramId = String(ctx.match[1]);
  ctx.scene.state.selectedTeacherId = teacherTelegramId;
  await ctx.reply('✅ Teacher selected. Now send your message or any media (photo, video, document, audio, voice, sticker, etc.).');
});

contactTeachersScene.action('cancel_contact_teacher', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.selectedTeacherId = null;
  await ctx.reply('🛑 Cancelled.', parentMenu);
  return ctx.scene.leave();
});

contactTeachersScene.hears(/^(?:🛑\s*Cancel|Cancel|cancel|exit)$/i, async (ctx) => {
  ctx.scene.state.selectedTeacherId = null;
  await ctx.reply('🛑 Cancelled.', parentMenu);
  return ctx.scene.leave();
});

contactTeachersScene.on('message', async (ctx) => {
  const senderId = String(ctx.from.id);
  const teacherTelegramId = ctx.scene.state.selectedTeacherId;
  if (!teacherTelegramId) {
    await ctx.reply('⚠️ Please select a teacher first.');
    return;
  }

  const todayShort = getContactWeekdayShort(new Date()); // e.g., "Mon"
  if (!PARENT_CONTACT_DAYS.includes(todayShort)) {
    await ctx.reply(`🛑 Contacting teachers is not allowed today. Allowed days: ${PARENT_CONTACT_DAYS.join(', ')}`, parentMenu);
    ctx.scene.state.selectedTeacherId = null;
    return ctx.scene.leave();
  }

  const dayKey = getContactDayKey(new Date());

  try {
    const countToday = await ParentContact.countDocuments({ parentTelegramId: senderId, dayKey });
    if (countToday >= PARENT_CONTACTS_PER_DAY) {
      await ctx.reply(`🛑 You have already contacted a teacher ${PARENT_CONTACTS_PER_DAY} time(s) for the current day (day starts at ${CONTACT_RESET_HOUR}:00). Please try again later.`, parentMenu);
      ctx.scene.state.selectedTeacherId = null;
      return ctx.scene.leave();
    }
  } catch (err) {
    console.error('Error counting ParentContact:', err);
  }

  const teacherIdNumeric = teacherTelegramId; // used in send/copy
  const senderName = ctx.from.first_name || ctx.from.username || 'Parent';
  let messageType = 'TEXT';
  try {
    try {
      await ctx.telegram.copyMessage(teacherIdNumeric, ctx.chat.id, ctx.message.message_id);
    } catch (copyErr) {
      if (ctx.message.text) {
        await ctx.telegram.sendMessage(teacherIdNumeric, `📩 Message from ${senderName}:\n\n${ctx.message.text}`);
        messageType = 'TEXT';
      } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.telegram.sendPhoto(teacherIdNumeric, photo.file_id, { caption: ctx.message.caption ? `📩 ${ctx.message.caption}` : `📩 Photo from ${senderName}` });
        messageType = 'PHOTO';
      } else if (ctx.message.video) {
        await ctx.telegram.sendVideo(teacherIdNumeric, ctx.message.video.file_id, { caption: ctx.message.caption || `📩 Video from ${senderName}` });
        messageType = 'VIDEO';
      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(teacherIdNumeric, ctx.message.document.file_id, { caption: ctx.message.caption || `📩 Document from ${senderName}` });
        messageType = 'DOCUMENT';
      } else if (ctx.message.audio) {
        await ctx.telegram.sendAudio(teacherIdNumeric, ctx.message.audio.file_id, { caption: ctx.message.caption || `📩 Audio from ${senderName}` });
        messageType = 'AUDIO';
      } else if (ctx.message.voice) {
        await ctx.telegram.sendVoice(teacherIdNumeric, ctx.message.voice.file_id);
        await ctx.telegram.sendMessage(teacherIdNumeric, `🎤 Voice message from ${senderName}`);
        messageType = 'VOICE';
      } else if (ctx.message.sticker) {
        await ctx.telegram.sendSticker(teacherIdNumeric, ctx.message.sticker.file_id);
        await ctx.telegram.sendMessage(teacherIdNumeric, `� Sticker from ${senderName}`);
        messageType = 'STICKER';
      } else if (ctx.message.animation) {
        await ctx.telegram.sendAnimation(teacherIdNumeric, ctx.message.animation.file_id, { caption: ctx.message.caption || `📩 Animation from ${senderName}` });
        messageType = 'ANIMATION';
      } else {
        await ctx.telegram.forwardMessage(teacherIdNumeric, ctx.chat.id, ctx.message.message_id);
        messageType = 'FORWARD';
      }
    }

    const studentCandidates = await getStudentsByParentId(senderId);
    const studentIds = Array.isArray(studentCandidates) && studentCandidates.length ? studentCandidates.map(s=>s.studentId) : [];

    await ParentContact.create({
      parentTelegramId: senderId,
      teacherTelegramId: String(teacherTelegramId),
      studentIds,
      messageType,
      messageText: ctx.message.text || ctx.message.caption || null,
      originalMessageId: ctx.message.message_id,
      dayKey,
      createdAt: new Date()
    });

    await ctx.reply('✅ Your message was sent to the teacher. Note: you can contact teachers only the allowed number of times per day.', parentMenu);
    

  } catch (err) {
    console.error('Error sending parent->teacher message:', err);
    await ctx.reply('🛑 Failed to send your message to the teacher. Please try again later.', parentMenu);
  }

  ctx.scene.state.selectedTeacherId = null;
  return ctx.scene.leave();
});

stage.register(contactTeachersScene);





const announceStudentsScene = new Scenes.BaseScene('announce_students_scene');

announceStudentsScene.enter(async (ctx) => {
  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) {
    await ctx.reply('🛑 Teacher profile not found.');
    return ctx.scene.leave();
  }

  const subjects = teacher.subjects || [];
  const classes = await TeacherStudent.distinct('className', { teacherId: teacher.teacherId });

  if (subjects.length === 0 && classes.length === 0) {
    await ctx.reply('🛑 You have no subjects or classes linked.');
    return ctx.scene.leave();
  }

  const keyboard = [
    ...subjects.map(s => [Markup.button.callback(`📘 Subject: ${s}`, `announce_subject_${s}`)]),
    ...classes.map(c => [Markup.button.callback(`🏫 Class: ${c}`, `announce_class_${c}`)]),
    [Markup.button.callback('🛑 Cancel', 'cancel_announce')]
  ];
  await ctx.reply('📢 Choose where to send your announcement:', Markup.inlineKeyboard(keyboard));
});

announceStudentsScene.action(/^announce_subject_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.type = 'subject';
  ctx.scene.state.target = ctx.match[1];
  await ctx.reply(`✅ Selected subject: ${ctx.match[1]}\n\nNow send your announcement message or media.`);
});

announceStudentsScene.action(/^announce_class_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.type = 'class';
  ctx.scene.state.target = ctx.match[1];
  await ctx.reply(`✅ Selected class: ${ctx.match[1]}\n\nNow send your announcement message or media.`);
});

announceStudentsScene.action('cancel_announce', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 Announcement cancelled.', teacherMenu);
  return ctx.scene.leave();
});

announceStudentsScene.on('message', async (ctx) => {
  const { type, target } = ctx.scene.state;
  if (!type || !target) return ctx.reply('⚠️ Please select a class or subject first.');

  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) return ctx.reply('🛑 Teacher profile not found.');

  const msg = ctx.message;
  let mediaPath = null;

  // --- Handle media saving ---
  try {
    const fileId =
      msg.photo?.[msg.photo.length - 1]?.file_id ||
      msg.video?.file_id ||
      msg.document?.file_id ||
      msg.audio?.file_id ||
      null;

    if (fileId) {
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;
      const fileExt = path.extname(file.file_path) || '.dat';
      const fileName = `${Date.now()}_${teacher.teacherId}${fileExt}`;
      const savePath = path.join(__dirname, 'mediaFromTeacher', fileName);

      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(savePath, response.data);

      mediaPath = `/media/${fileName}`;
    }
  } catch (err) {
    console.error('Error saving media:', err.message);
  }

  // --- Save to DB (for web portal) ---
  const announcement = await Announcement.create({
    teacherId: teacher.teacherId,
    teacherName: teacher.name,
    type,
    target,
    telegramId: ctx.from.id,
    message: {
      text: msg.text || msg.caption || null,
      mediaPath: mediaPath,
      mediaType: msg.photo ? 'photo' : msg.video ? 'video' : msg.document ? 'document' : msg.audio ? 'audio' : null,
    },
    createdAt: new Date(),
  });

  await ctx.reply('✅ Announcement saved and sent to portal.');

  // --- Pull registered users from auth DB ---
  const registeredUsers = (typeof authDB.getAllUsers === 'function')
    ? authDB.getAllUsers()
    : (authDB.users || []);

  let recipients = [];

  // --- CLASS announcement ---
  if (type === 'class') {
    // Students in this class and registered on portal
    const dbStudents = await Student.find({ class: target });
    const dbIds = dbStudents.map(s => s.studentId);
    recipients = registeredUsers.filter(u => dbIds.includes(u.studentId));
  }

  // --- SUBJECT announcement ---
  if (type === 'subject') {
    const rels = await TeacherStudent.find({ teacherId: teacher.teacherId, subject: target });
    const subjectIds = rels.map(r => r.studentId);
    recipients = registeredUsers.filter(u => subjectIds.includes(u.studentId));
  }

  

  // --- Send announcement ---
  for (const user of recipients) {
    try {
      const s = await Student.findOne({ studentId: user.studentId });
      if (!s || !s.telegramId) continue;

      await bot.telegram.sendMessage(
        s.telegramId,
        `📢 <b>New Announcement</b>\nFrom: ${teacher.name}\n${type === 'class' ? `Class: ${target}` : `Subject: ${target}`}\n\n${msg.text || msg.caption || ''}`,
        { parse_mode: 'HTML' }
      );

      if (mediaPath) {
        const fullPath = path.join(__dirname, 'mediaFromTeacher', path.basename(mediaPath));
        if (fs.existsSync(fullPath)) {
          const mt = announcement.message.mediaType;
          if (mt === 'photo') await bot.telegram.sendPhoto(s.telegramId, { source: fullPath });
          else if (mt === 'video') await bot.telegram.sendVideo(s.telegramId, { source: fullPath });
          else if (mt === 'document') await bot.telegram.sendDocument(s.telegramId, { source: fullPath });
          else if (mt === 'audio') await bot.telegram.sendAudio(s.telegramId, { source: fullPath });
        }
      }
    } catch (err) {
      console.error(`❌ Failed to send to ${user.studentId}:`, err.message);
    }
  }

  await ctx.scene.leave();
});


stage.register(announceStudentsScene);




// --- Teacher Remove Class Scene ---
const teacherRemoveClassScene = new Scenes.BaseScene('teacher_remove_class_scene');

teacherRemoveClassScene.enter(async (ctx) => {
  await ctx.reply(
    '🔒 Remove Class Mode — select a class to delete.\n🛑 Press Cancel to exit.',
    Markup.keyboard([['🛑 Cancel']]).resize()
  );

  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) {
    await ctx.reply('🛑 Teacher profile not found.', teacherMenu);
    return ctx.scene.leave();
  }

  const classes = await TeacherStudent.distinct('className', { teacherId: teacher.teacherId });

  if (!classes || classes.length === 0) {
    await ctx.reply('🛑 You have no classes to remove.', teacherMenu);
    return ctx.scene.leave();
  }

  const buttons = classes.map(c => [Markup.button.callback(`🗑 ${c}`, `remove_class_${c}`)]);
  buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_remove_class')]);

  await ctx.reply('📚 Select the class you want to remove:', Markup.inlineKeyboard(buttons));
});

teacherRemoveClassScene.action(/^remove_class_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const className = ctx.match[1];
  ctx.scene.state.className = className;

  await ctx.reply(
    `⚠️ Are you sure you want to remove the entire class <b>${className}</b> from your database?\nThis will delete all linked students for this class.`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, remove', 'confirm_remove_class')],
        [Markup.button.callback('🛑 Cancel', 'cancel_remove_class')]
      ])
    }
  );
});

teacherRemoveClassScene.action('confirm_remove_class', async (ctx) => {
  await ctx.answerCbQuery();
  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) {
    await ctx.reply('🛑 Teacher profile not found.', teacherMenu);
    return ctx.scene.leave();
  }

  const className = ctx.scene.state.className;
  const result = await TeacherStudent.deleteMany({ teacherId: teacher.teacherId, className });

  await ctx.reply(
    `✅ Removed class <b>${className}</b> from your records.\n🗑 Total deleted links: ${result.deletedCount}`,
    { parse_mode: 'HTML', reply_markup: teacherMenu.reply_markup }
  );
  return ctx.scene.leave();
});

teacherRemoveClassScene.action('cancel_remove_class', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 Cancelled.', teacherMenu);
  return ctx.scene.leave();
});
teacherRemoveClassScene.hears(/^(?:🛑\s*Cancel|Cancel|cancel|exit)$/i, async (ctx) => {
  await ctx.reply('🛑 Cancelled.', teacherMenu);
  return ctx.scene.leave();
});

 
stage.register(teacherRemoveClassScene);


 
// --- Contact Admins Scene ---
const contactAdminsScene = new Scenes.BaseScene('contact_admins_scene');

contactAdminsScene.enter(async (ctx) => {
  try {
    const currentId = String(ctx.from.id);

    const admins = await User.find({ role: 'admin' });

    const otherAdmins = admins.filter(a => String(a.telegramId) !== currentId);

    if (!otherAdmins || otherAdmins.length === 0) {
      await ctx.reply('🛑 No other admins are currently available.', adminMenu);
      return ctx.scene.leave();
    }

    const rows = otherAdmins.map(a => [
      Markup.button.callback(
        `${a.name || a.username || 'Admin'}${a.adminId ? ` (${a.adminId})` : ''}`,
        `select_admin_${a.telegramId}`
      )
    ]);

    await ctx.reply('👑 Select an admin you want to contact:', Markup.inlineKeyboard(rows));

    await ctx.reply(
      '🔒 Contact Admin Mode — select an admin then send your message (text or any media)',
      Markup.keyboard([['🛑 Cancel']]).resize()
    );

  } catch (err) {
    console.error('contactAdminsScene.enter error:', err);
    await ctx.reply('🛑 Failed to load admins.', adminMenu);
    return ctx.scene.leave();
  }
});


contactAdminsScene.action(/^select_admin_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const id = ctx.match[1].toString();
  ctx.scene.state.selectedAdminId = id;
  await ctx.reply('✅ Admin selected. Now send your message or media.');
});

contactAdminsScene.action('cancel_contact_admin', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.selectedAdminId = null;
  await ctx.reply('🛑 Contact Admins cancelled.', adminMenu);
  return ctx.scene.leave();
});

contactAdminsScene.hears(/^(?:🛑\s*Cancel|Cancel|cancel|exit)$/i, async (ctx) => {
  ctx.scene.state.selectedAdminId = null;
  await ctx.reply('🛑 Contact Admins cancelled.', adminMenu);
  return ctx.scene.leave();
});

contactAdminsScene.on('message', async (ctx) => {
  if (ctx.message && ctx.message.text && /^(?:🛑\s*Cancel|Cancel|cancel|exit)$/i.test(ctx.message.text)) {
    await logAdminAction(ctx, 'CONTACT_ADMIN_CANCELLED', { senderId: ctx.from.id });
    await ctx.reply('🛑 Contact admin operation cancelled.', adminMenu);
    return ctx.scene.leave();
  }

  const recipientAdminId = ctx.scene.state.selectedAdminId;
  if (!recipientAdminId) {
    return ctx.reply('⚠️ Please select an admin first!');
  }

  const senderName = ctx.from.first_name || ctx.from.username || 'User';
  const senderId = ctx.from.id;
  const timestamp = new Date().toLocaleString();

  try {
    try {
      await ctx.telegram.sendMessage(recipientAdminId, `📩 Message from ${senderName}:`);
      await ctx.telegram.copyMessage(recipientAdminId, ctx.chat.id, ctx.message.message_id);
    } catch (copyErr) {
      console.warn('copyMessage failed, fallback to manual send:', copyErr.message);

      if (ctx.message.text) {
        await ctx.telegram.sendMessage(recipientAdminId, `📩 Message from ${senderName}:\n\n${ctx.message.text}`);
      } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.telegram.sendPhoto(recipientAdminId, photo.file_id, { caption: `📩 Photo from ${senderName}${ctx.message.caption ? `:\n${ctx.message.caption}` : ''}` });
      } else if (ctx.message.video) {
        await ctx.telegram.sendVideo(recipientAdminId, ctx.message.video.file_id, { caption: ctx.message.caption || `📩 Video from ${senderName}` });
      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(recipientAdminId, ctx.message.document.file_id, { caption: ctx.message.caption || `📩 Document from ${senderName}` });
      } else if (ctx.message.audio) {
        await ctx.telegram.sendAudio(recipientAdminId, ctx.message.audio.file_id, { caption: ctx.message.caption || `📩 Audio from ${senderName}` });
      } else if (ctx.message.voice) {
        await ctx.telegram.sendVoice(recipientAdminId, ctx.message.voice.file_id);
        await ctx.telegram.sendMessage(recipientAdminId, `🎤 Voice message from ${senderName}`);
      } else if (ctx.message.sticker) {
        await ctx.telegram.sendSticker(recipientAdminId, ctx.message.sticker.file_id);
        await ctx.telegram.sendMessage(recipientAdminId, `� Sticker from ${senderName}`);
      } else if (ctx.message.animation) {
        await ctx.telegram.sendAnimation(recipientAdminId, ctx.message.animation.file_id, { caption: ctx.message.caption || `📩 Animation from ${senderName}` });
      } else {
        await ctx.telegram.forwardMessage(recipientAdminId, ctx.chat.id, ctx.message.message_id);
      }
    }

    // --- LOGGING ---
    await logAdminAction(ctx, 'CONTACT_ADMIN_MESSAGE', {
      fromAdmin: senderName,
      fromId: senderId,
      toAdminId: recipientAdminId,
      type: ctx.message.text ? 'TEXT' : Object.keys(ctx.message).find(k =>
        ['photo', 'video', 'document', 'audio', 'voice', 'sticker', 'animation'].includes(k)
      ),
      message: ctx.message.text || ctx.message.caption || null,
      date: timestamp
    });

    // --- NOTIFY MASTER ADMIN ---
    if (process.env.MASTER_ADMIN_ID) {
      let masterCaption = `🚨 <b>Admin-to-Admin Message</b>\n\n` +
        `👤 From: ${senderName} (ID: ${senderId})\n` +
        `➡️ To Admin ID: ${recipientAdminId}\n` +
        `📅 Date: ${timestamp}\n\n`;

      if (ctx.message.text) {
        masterCaption += `💬 Message: ${ctx.message.text}`;
        await ctx.telegram.sendMessage(process.env.MASTER_ADMIN_ID, masterCaption, { parse_mode: 'HTML' });
      } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.telegram.sendPhoto(process.env.MASTER_ADMIN_ID, photo.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      } else if (ctx.message.video) {
        await ctx.telegram.sendVideo(process.env.MASTER_ADMIN_ID, ctx.message.video.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(process.env.MASTER_ADMIN_ID, ctx.message.document.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      } else if (ctx.message.audio) {
        await ctx.telegram.sendAudio(process.env.MASTER_ADMIN_ID, ctx.message.audio.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      } else if (ctx.message.voice) {
        await ctx.telegram.sendVoice(process.env.MASTER_ADMIN_ID, ctx.message.voice.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      } else if (ctx.message.sticker) {
        await ctx.telegram.sendSticker(process.env.MASTER_ADMIN_ID, ctx.message.sticker.file_id);
        await ctx.telegram.sendMessage(process.env.MASTER_ADMIN_ID, masterCaption, { parse_mode: 'HTML' });
      } else if (ctx.message.animation) {
        await ctx.telegram.sendAnimation(process.env.MASTER_ADMIN_ID, ctx.message.animation.file_id, { caption: masterCaption, parse_mode: 'HTML' });
      }
    }

    ctx.scene.state.selectedAdminId = null;
    await ctx.reply('✅ Your message has been sent.', adminMenu);
    return ctx.scene.leave();

  } catch (err) {
    console.error('Error forwarding message to admin:', err);
    ctx.scene.state.selectedAdminId = null;
    await ctx.reply('🛑 Failed to send your message. Please try again later.', adminMenu);
    return ctx.scene.leave();
  }
});


stage.register(contactAdminsScene);


//////////////////----------------------------------Amharic Version for Parents--------------------------------//////////
///
//
//


// Scene
const contactTeachersSceneAm = new Scenes.BaseScene('contact_teachers_scene_am');

contactTeachersSceneAm.enter(async (ctx) => {
  try {
    const parentTelegramId = String(ctx.from.id);
    const students = await getStudentsByParentId(parentTelegramId);
    if (!students || students.length === 0) {
      await ctx.reply('🛑 ከእርስዎ ጋር የተያያዙ ተማሪዎች አልተገኙም። እባክዎ መጀመሪያ ተማሪ ያያዙ ወይም ከአስተዳዳሪ ጋር ያገናኙ።', parentMenuAm);
      return ctx.scene.leave();
    }

    const studentIds = students.map(s => s.studentId);
    const relations = await TeacherStudent.find({}).then(all => all.filter(r => studentIds.includes(r.studentId)));
    const teacherIdSet = new Set(relations.map(r => String(r.teacherId)));
    if (teacherIdSet.size === 0) {
      await ctx.reply('🛑 ለከተገናኙት ተማሪ(ዎች) ምንም አስተማሪ አልተገኘም።', parentMenuAm);
      return ctx.scene.leave();
    }

    const teacherButtons = [];
    for (const tId of teacherIdSet) {
      const teacher = await Teacher.findOne({ teacherId: tId });
      if (teacher && teacher.telegramId) {
        const label = `${teacher.name || teacher.username || 'Teacher'}${teacher.teacherId ? ` (${teacher.teacherId})` : ''}`;
        teacherButtons.push([ Markup.button.callback(label, `select_teacher_${teacher.telegramId}`) ]);
      } else {
      }
    }

    if (teacherButtons.length === 0) {
      await ctx.reply('🛑 ለተማሪዎችዎ በቴሌግራም አካውንት ያላቸው አስተማሪዎች አልተገኙም።', parentMenuAm);
      return ctx.scene.leave();
    }

    teacherButtons.push([ Markup.button.callback('🛑 ሰርዝ', 'cancel_contact_teacher') ]);
    await ctx.reply('👩‍🏫 ለመገናኘት የሚፈልጉትን አስተማሪ ይምረጡ (ጽሑፍ ወይም ማንኛውንም ሚዲያ ማስተላለፍ ይችላሉ)።', Markup.inlineKeyboard(teacherButtons));

    await ctx.reply('🔒 አስተማሪ ከምረጡ በኋላ መልእክትዎን ይላኩ ወይም ሚዲያ ያክሉ። ለመውጣት “ሰርዝ” ይጫኑ።', Markup.keyboard([['🛑 ሰርዝ']]).resize());
  } catch (err) {
    console.error('contactTeachersScene.enter error:', err);
    await ctx.reply('🛑 Failed to load teachers. Please try again later.');
    return ctx.scene.leave();
  }
});

contactTeachersSceneAm.action(/^select_teacher_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const teacherTelegramId = String(ctx.match[1]);
  ctx.scene.state.selectedTeacherId = teacherTelegramId;
  await ctx.reply('✅ አስተማሪው ተመርጧል። አሁን መልእክትዎን ይላኩ ወይም ማንኛውንም ሚዲያ (ፎቶ, ቪዲዮ, ሰነድ, አውዲዮ, ድምጽ, ስቲከር ወዘተ) ይጫኑ።');
});

contactTeachersSceneAm.action('cancel_contact_teacher', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.state.selectedTeacherId = null;
  await ctx.reply('🛑 ተሰርዟል።', parentMenuAm);
  return ctx.scene.leave();
});

contactTeachersSceneAm.hears(/^(?:🛑\s*ሰርዝ)$/i, async (ctx) => {
  ctx.scene.state.selectedTeacherId = null;
  await ctx.reply('🛑 ተሰርዟል።', parentMenuAm);
  return ctx.scene.leave();
});

contactTeachersSceneAm.on('message', async (ctx) => {
  const senderId = String(ctx.from.id);
  const teacherTelegramId = ctx.scene.state.selectedTeacherId;
  if (!teacherTelegramId) {
    await ctx.reply('⚠️ እባክዎ መጀመሪያ አስተማሪ ይምረጡ።');
    return;
  }

  const todayShort = getContactWeekdayShort(new Date()); // e.g., "Mon"
  if (!PARENT_CONTACT_DAYS.includes(todayShort)) {
    await ctx.reply(`🛑 ዛሬ ከአስተማሪዎች ጋር መገናኘት የማይፈቀድ ነው። የተፈቀዱ ቀናቶች: ${PARENT_CONTACT_DAYS.join(', ')}`, parentMenuAm);
    ctx.scene.state.selectedTeacherId = null;
    return ctx.scene.leave();
  }

  const dayKey = getContactDayKey(new Date());

  try {
    const countToday = await ParentContact.countDocuments({ parentTelegramId: senderId, dayKey });
    if (countToday >= PARENT_CONTACTS_PER_DAY) {
      await ctx.reply(`🛑 እስካሁን ለዛሬ ቀን ከአስተማሪ ጋር ${PARENT_CONTACTS_PER_DAY} ጊዜ ተገናኝተዋል (ቀን ከ ${CONTACT_RESET_HOUR}:00 ጀምሮ ይቆያል)። እባክዎ በኋላ ደግመው ይሞክሩ።`, parentMenuAm);
      ctx.scene.state.selectedTeacherId = null;
      return ctx.scene.leave();
    }
  } catch (err) {
    console.error('Error counting ParentContact:', err);
  }

  const teacherIdNumeric = teacherTelegramId; // used in send/copy
  const senderName = ctx.from.first_name || ctx.from.username || 'Parent';
  let messageType = 'TEXT';
  try {
    try {
      await ctx.telegram.copyMessage(teacherIdNumeric, ctx.chat.id, ctx.message.message_id);
    } catch (copyErr) {
      if (ctx.message.text) {
        await ctx.telegram.sendMessage(teacherIdNumeric, `📩 Message from ${senderName}:\n\n${ctx.message.text}`);
        messageType = 'TEXT';
      } else if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.telegram.sendPhoto(teacherIdNumeric, photo.file_id, { caption: ctx.message.caption ? `📩 ${ctx.message.caption}` : `📩 Photo from ${senderName}` });
        messageType = 'PHOTO';
      } else if (ctx.message.video) {
        await ctx.telegram.sendVideo(teacherIdNumeric, ctx.message.video.file_id, { caption: ctx.message.caption || `📩 Video from ${senderName}` });
        messageType = 'VIDEO';
      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(teacherIdNumeric, ctx.message.document.file_id, { caption: ctx.message.caption || `📩 Document from ${senderName}` });
        messageType = 'DOCUMENT';
      } else if (ctx.message.audio) {
        await ctx.telegram.sendAudio(teacherIdNumeric, ctx.message.audio.file_id, { caption: ctx.message.caption || `📩 Audio from ${senderName}` });
        messageType = 'AUDIO';
      } else if (ctx.message.voice) {
        await ctx.telegram.sendVoice(teacherIdNumeric, ctx.message.voice.file_id);
        await ctx.telegram.sendMessage(teacherIdNumeric, `🎤 Voice message from ${senderName}`);
        messageType = 'VOICE';
      } else if (ctx.message.sticker) {
        await ctx.telegram.sendSticker(teacherIdNumeric, ctx.message.sticker.file_id);
        await ctx.telegram.sendMessage(teacherIdNumeric, `� Sticker from ${senderName}`);
        messageType = 'STICKER';
      } else if (ctx.message.animation) {
        await ctx.telegram.sendAnimation(teacherIdNumeric, ctx.message.animation.file_id, { caption: ctx.message.caption || `📩 Animation from ${senderName}` });
        messageType = 'ANIMATION';
      } else {
        await ctx.telegram.forwardMessage(teacherIdNumeric, ctx.chat.id, ctx.message.message_id);
        messageType = 'FORWARD';
      }
    }

    const studentCandidates = await getStudentsByParentId(senderId);
    const studentIds = Array.isArray(studentCandidates) && studentCandidates.length ? studentCandidates.map(s=>s.studentId) : [];

    await ParentContact.create({
      parentTelegramId: senderId,
      teacherTelegramId: String(teacherTelegramId),
      studentIds,
      messageType,
      messageText: ctx.message.text || ctx.message.caption || null,
      originalMessageId: ctx.message.message_id,
      dayKey,
      createdAt: new Date()
    });

    await ctx.reply('✅ መልእክትዎ ወደ አስተማሪ ተልኳል። ማስታወሻ: ከአስተማሪዎች ጋር በቀን የተፈቀደው ብዛት ብቻ መገናኘት ይችላሉ።', parentMenuAm);
    

  } catch (err) {
    console.error('Error sending parent->teacher message:', err);
    await ctx.reply('🛑 መልእክትዎን ወደ አስተማሪ መላክ አልተሳካም። እባክዎ በኋላ ደግመው ይሞክሩ።', parentMenuAm);
  }

  ctx.scene.state.selectedTeacherId = null;
  return ctx.scene.leave();
});

stage.register(contactTeachersSceneAm);


const linkAnotherStudentSceneAm = new Scenes.BaseScene('link_another_student_scene_am');

linkAnotherStudentSceneAm.enter((ctx) => {
  ctx.reply(
    '🔗 ሌላ ተማሪ አገናኝ\n\n' +
    'እባክዎ ልጅዎን ለማገናኘት የተማሪ መታወቂያ ያስገቡ (ለምሳሌ፦ ST1234):',
    Markup.keyboard([['🛑 ሰርዝ']]).resize()
  );
});

linkAnotherStudentSceneAm.on('text', async (ctx) => {
  const input = ctx.message.text.trim().toUpperCase();

  if (input === '🛑 ሰርዝ') {
    await ctx.reply('🛑 የመገናኛ ሂደት ተሰርዟል።', parentMenuAm);
    return ctx.scene.leave();
  }

  if (!/^ST\d+$/.test(input)) {
    await ctx.reply(
      '🛑 የተሳሳተ የተማሪ መታወቂያ። በዚህ ቅጥ ST1234 መሆን አለበት።\n\nእባክዎ እንደገና ያስገቡ ወይም ሰርዙ፦',
      Markup.keyboard([['🛑 ሰርዝ']]).resize()
    );
    return;
  }

  try {
    const student = await Student.findOne({ studentId: input });
    if (!student) {
      await ctx.reply('🛑 የተማሪ መታወቂያ አልተገኘም።');
      return;
    }

    if (student.parentId || student.pendingParentId) {
      await ctx.reply('🛑 ይህ ተማሪ አስቀድሞ ከሌላ ወላጅ ጋር ተገናኝቷል ወይም በመጠባበቅ ላይ ነው።');
      return;
    }

    const parentId = ctx.from.id.toString();
    const parentUser = await User.findOne({ telegramId: parentId });

    student.pendingParentId = parentId;
    student.pendingParentAt = Date.now();
    await student.save();

    if (parentUser) {
      parentUser.pendingStudentRequests = parentUser.pendingStudentRequests || [];
      parentUser.pendingStudentRequests.push({ studentId: input, requestedAt: Date.now() });
      await parentUser.save();
    }

    const parentName = parentUser?.name || ctx.from.first_name || 'ወላጅ';
    const requestId = `${parentId}_${input}`;
    const sentMessages = [];

    const admins = await getAdmins();
    for (const admin of admins) {
      try {
        const msg = await ctx.telegram.sendMessage(
          admin.telegramId,
          `📋 <b>Parent link request:</b>\n\n` +
          `👤 Parent: <b>${parentName}</b> (ID: ${parentId})\n` +
          `🎓 Student: <b>${input}</b>\n` +
          `📅 Date: <b>${new Date().toLocaleString('am-ET', { timeZone: 'Africa/Nairobi' })}</b>\n\n` +
          `please review and approve or deny the request:`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Approve', `approve_parent_${parentId}_${input}`),
                Markup.button.callback('🛑 Deny', `deny_parent_${parentId}_${input}`)
              ]
            ])
          }
        );
        sentMessages.push({ adminId: admin.telegramId, messageId: msg.message_id });
      } catch (err) {
        console.error(`Failed to notify admin ${admin.telegramId}:`, err.message);
      }
    }

    if (sentMessages.length > 0) {
      await ApprovalMessage.create({
        type: 'parent',
        requestId,
        messages: sentMessages,
        createdAt: new Date()
      });
    }

    await ctx.replyWithHTML(
      `✅ <b>የመገናኛ ጥያቄ ተላክ!</b>\n\n` +
      `🎓 ተማሪ መታወቂያ፦ <b>${input}</b>\n` +
      `⏳ ሁኔታ፦ በአስተዳዳሪ ማረጋገጫ መጠባበቅ ላይ።\n\n` +
      `አስተዳዳሪዎች ሲያረጋግጡ ወይም ሲከልክሉ ይወዳደሩ።`,
      parentMenuAm
    );
    ctx.scene.leave();

    setTimeout(async () => {
      try {
        const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
        if (!approval) return; 

        const freshStudent = await Student.findOne({ studentId: input });
        if (!freshStudent) return;

        if (freshStudent.pendingParentId === parentId) {
          freshStudent.pendingParentId = null;
          freshStudent.pendingParentAt = null;
          await freshStudent.save();

          const freshUser = await User.findOne({ telegramId: parentId });
          if (freshUser) {
            freshUser.pendingStudentRequests = (freshUser.pendingStudentRequests || []).filter(r => r.studentId !== input);
            await freshUser.save();
          }

          await ApprovalMessage.deleteOne({ _id: approval._id });

          const expiredText =
            `⌛ <b>Parent link requset expired</b>\n\n` +
            `👤 Parent: <b>${parentName}</b> (ID: ${parentId})\n` +
            `🎓 Student: <b>${input}</b>\n` +
            `📅 Date: <b>${approval.createdAt.toLocaleString('am-ET', { timeZone: 'Africa/Nairobi' })}</b>\n\n` +
            `⚠️ Admins did not respond within 5 minutes, so the request has expired.`;

          const master = await User.findOne({ role: 'masterAdmin' });
          if (master) {
            await ctx.telegram.sendMessage(master.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          for (const admin of admins) {
            await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          await ctx.telegram.sendMessage(
            parentId,
            `⚠️ የተማሪ መገናኛ ጥያቄዎ በ 5 ደቂቃ ውስጥ አልተወሰነም። እባክዎ እንደገና ይሞክሩ።`,
            { parse_mode: 'HTML' }
          );

        }
      } catch (err) {
        console.error('Error auto-clearing expired parent link (Amharic):', err);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error linking student (Amharic):', error);
    await ctx.reply(
      '🛑 ተማሪን በመገናኘት ላይ ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ ወይም ሰርዙ፦',
      Markup.keyboard([['🛑 ሰርዝ']]).resize()
    );
  }
});

stage.register(linkAnotherStudentSceneAm);


// Parent Unlink Scene (Amharic)
const parentUnlinkSceneAm = new Scenes.BaseScene('parent_unlink_scene_am');

parentUnlinkSceneAm.enter(async (ctx) => {
  try {
    const parent = await User.findOne({ telegramId: ctx.from.id.toString(), role: 'parentAm' });
    if (!parent) {
      await ctx.reply('🛑 እርስዎ እንደ ወላጅ አልተመዘገቡም።', loginMenu);
      return ctx.scene.leave();
    }

    if (!parent.studentIds || parent.studentIds.length === 0) {
      await ctx.reply('🛑 ልጆች ከመለያዎ ጋር አልተገናኙም።', loginMenu);
      return ctx.scene.leave();
    }

    const students = await Promise.all(
      parent.studentIds.map(async (studentId) => {
        const student = await Student.findOne({ studentId });
        return student ? { studentId, name: student.name, class: student.class } : null;
      })
    );

    const validStudents = students.filter(s => s);
    if (validStudents.length === 0) {
      await ctx.reply('🛑 ትክክለኛ ተማሪዎች አልተገኙም።', loginMenu);
      return ctx.scene.leave();
    }

    const studentButtons = validStudents.map(student => [
      Markup.button.callback(
        `${student.name} (${student.studentId})`,
        `unlink_am_select_${student.studentId}`
      )
    ]);
    studentButtons.push([Markup.button.callback('🛑 ሰርዝ', 'unlink_am_cancel')]);

    await ctx.reply(
      '👶 ከመለያዎ ለመለየት ተማሪ ይምረጡ፦',
      Markup.inlineKeyboard(studentButtons)
    );

  } catch (error) {
    console.error('Error entering parent unlink scene (Amharic):', error);
    await ctx.reply('🛑 ልጆችን በመጫን ላይ ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', loginMenu);
    ctx.scene.leave();
  }
});

parentUnlinkSceneAm.action(/^unlink_am_select_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const studentId = ctx.match[1];

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      await ctx.reply('🛑 ተማሪ በዳታቤዝ ውስጥ አልተገኘም።', parentMenuAm);
      return ctx.scene.leave();
    }

    ctx.session.unlinkStudentId = studentId;
    ctx.session.unlinkStudentName = student.name;

    await ctx.reply(
      `⚠️ ተማሪውን ${student.name} (${studentId}) ከመለያዎ ለመለየት ትፈልጋለህ?`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ አረጋግጥ', 'unlink_am_confirm'),
        Markup.button.callback('🛑 ሰርዝ', 'unlink_am_cancel')
      ])
    );

  } catch (error) {
    console.error('Error selecting student for unlink (Amharic):', error);
    await ctx.reply('🛑 ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', parentMenuAm);
    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();
  }
});

parentUnlinkSceneAm.action('unlink_am_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  const { unlinkStudentId, unlinkStudentName } = ctx.session;

  if (!unlinkStudentId) {
    await ctx.reply('🛑 ምንም ተማሪ አልተመረጠም። እባክዎ እንደገና ይጀምሩ።', parentMenuAm);
    return ctx.scene.leave();
  }

  try {
    const parent = await User.findOne({ telegramId: ctx.from.id.toString(), role: 'parentAm' });
    if (!parent) {
      await ctx.reply('🛑 የወላጅ ፕሮፋይል አልተገኘም።', parentMenuAm);
      return ctx.scene.leave();
    }

    if (!parent.studentIds.includes(unlinkStudentId)) {
      await ctx.reply('🛑 ይህ ተማሪ ከመለያዎ ጋር አልተገናኘም።', parentMenuAm);
      delete ctx.session.unlinkStudentId;
      delete ctx.session.unlinkStudentName;
      return ctx.scene.leave();
    }

    parent.pendingUnlinkStudentIds = parent.pendingUnlinkStudentIds || [];
    if (parent.pendingUnlinkStudentIds.includes(unlinkStudentId)) {
      await ctx.reply(
        `⚠️ የመለያ ማለያ ጥያቄ ለ ${unlinkStudentName} (${unlinkStudentId}) አስቀድሞ ተላክቷል።`,
        { reply_markup: parentMenuAm.reply_markup }
      );
      delete ctx.session.unlinkStudentId;
      delete ctx.session.unlinkStudentName;
      return ctx.scene.leave();
    }

    parent.pendingUnlinkStudentIds.push(unlinkStudentId);
    await parent.save();

    const parentId = ctx.from.id.toString();
    const requestId = `${parentId}_unlink_${unlinkStudentId}`;
    const sentMessages = [];

    const admins = await getAdmins();
    const masterAdmin = await User.findOne({ role: 'master_admin' });
    const masterAdminId = masterAdmin ? masterAdmin.telegramId : null;

    for (const admin of admins) {
      if (admin.role !== 'master_admin' && admin.telegramId !== parentId) {
        try {
          const msg = await ctx.telegram.sendMessage(
            admin.telegramId,
            `🛑 <b>የወላጅ መለያ ማለያ ጥያቄ</b>\n\n` +
            `👤 ወላጅ፦ <b>${parent.name}</b> (@${parent.username || 'N/A'})\n` +
            `👶 ተማሪ፦ <b>${unlinkStudentName}</b> (${unlinkStudentId})\n` +
            `📅 ቀን፦ ${new Date().toLocaleString('am-ET', { timeZone: 'Africa/Nairobi' })}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ አረጋግጥ', `approve_unlink:${parentId}:${unlinkStudentId}`),
                  Markup.button.callback('🛑 አትቀበል', `deny_unlink:${parentId}:${unlinkStudentId}`)
                ]
              ])
            }
          );
          sentMessages.push({ adminId: admin.telegramId, messageId: msg.message_id });
        } catch (error) {
          console.error(`Failed to notify admin ${admin.telegramId}:`, error);
        }
      }
    }

    if (sentMessages.length > 0) {
      await ApprovalMessage.create({
        type: 'unlink_parent',
        requestId,
        messages: sentMessages,
        createdAt: new Date()
      });
    }

    await ctx.reply(
      `✅ የመለያ ማለያ ጥያቄ ለ ${unlinkStudentName} (${unlinkStudentId}) ተላክ። በአስተዳዳሪ ማረጋገጫ መጠባበቅ ላይ።`,
      { reply_markup: parentMenuAm.reply_markup }
    );

    setTimeout(async () => {
      try {
        const approval = await ApprovalMessage.findOne({ type: 'unlink_parent', requestId });
        if (!approval) return;

        const freshParent = await User.findOne({ telegramId: parentId });
        if (freshParent && freshParent.pendingUnlinkStudentIds.includes(unlinkStudentId)) {
          freshParent.pendingUnlinkStudentIds = freshParent.pendingUnlinkStudentIds.filter(id => id !== unlinkStudentId);
          await freshParent.save();
          await ApprovalMessage.deleteOne({ _id: approval._id });

          const expiredText =
            `⌛ <b>የመለያ ማለያ ጥያቄ አልተሰራም</b>\n\n` +
            `👤 ወላጅ፦ <b>${parent.name}</b> (ID: ${parentId})\n` +
            `👶 ተማሪ፦ <b>${unlinkStudentName}</b> (${unlinkStudentId})\n` +
            `📅 ቀን፦ ${approval.createdAt.toLocaleString('am-ET', { timeZone: 'Africa/Nairobi' })}\n\n` +
            `⚠️ ከ 5 ደቂቃ በኋላ ምንም እርምጃ አልተወሰነም። ጥያቄው ተሰርዟል።`;

          if (masterAdminId) {
            await ctx.telegram.sendMessage(masterAdminId, expiredText, { parse_mode: 'HTML' });
          }
          for (const admin of admins) {
            await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          await ctx.telegram.sendMessage(
            parentId,
            `⚠️ የመለያ ማለያ ጥያቄዎ ከ 5 ደቂቃ በኋላ ተሰርዟል። እባክዎ እንደገና ይሞክሩ።`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        console.error('Error auto-clearing expired unlink (Amharic):', err);
      }
    }, 5 * 60 * 1000);

    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();

  } catch (error) {
    console.error('Error submitting unlink request (Amharic):', error);
    await ctx.reply('🛑 በመለያ ማለያ ጥያቄ ላክ ላይ ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።', loginMenu);
    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();
  }
});

parentUnlinkSceneAm.action('unlink_am_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 የመለያ ማለያ ሂደት ተሰርዟል።', { reply_markup: parentMenuAm.reply_markup });
  delete ctx.session.unlinkStudentId;
  delete ctx.session.unlinkStudentName;
  ctx.scene.leave();
});

stage.register(parentUnlinkSceneAm);


const parentRequestTutorSceneAm = new Scenes.BaseScene('parent_request_tutor_scene_am');

parentRequestTutorSceneAm.enter(async (ctx) => {
  const subjects = await Teacher.distinct('subjects');
  const buttons = subjects.flat().map(s => [Markup.button.callback(s, `subj_am_${s}`)]);
  ctx.reply('📚 ትምህርት ክፍል ይምረጡ፦', Markup.inlineKeyboard(buttons));
});

parentRequestTutorSceneAm.action(/^subj_am_(.+)$/, async (ctx) => {
  const subject = ctx.match[1];
  ctx.scene.session.subject = subject;
  const offers = await FreelanceOffer.find({ subject });

  if (offers.length === 0) {
    return ctx.reply('🛑 ለዚህ ትምህርት ቀጣሪ ቱተሮች አልተገኙም።');
  }

  const teacherIds = offers.map(o => o.teacherId);
  const teachers = await Teacher.find({ teacherId: { $in: teacherIds } });

  const buttons = offers.map(o => {
    const t = teachers.find(tt => tt.teacherId === o.teacherId);
    if (!t) return null;
    return [Markup.button.callback(
      `${t.name} — 💰${o.salaryPerHour}/ሰዓት | ⏱${o.hoursPerDay} ሰዓት/ቀን | 📅${o.daysPerWeek} ቀናት/ሳምንት`,
      `teach_am_${t.teacherId}`
    )];
  }).filter(Boolean);

  ctx.editMessageText(`👩‍🏫 ቀጣሪ ቱተሮች (${subject})`, Markup.inlineKeyboard(buttons));
});

parentRequestTutorSceneAm.action(/^teach_am_(.+)$/, async (ctx) => {
  ctx.scene.session.teacherId = ctx.match[1];
  ctx.reply(
    '📋 ይህን ቱተር ማስያዝ ትፈልጋለህ?',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ አረጋግጥ', 'confirm_am')],
      [Markup.button.callback('🛑 ተው', 'cancel_am')]
    ])
  );
});


parentRequestTutorSceneAm.action('confirm_am', async (ctx) => {
  const teacher = await Teacher.findOne({ teacherId: ctx.scene.session.teacherId });
  const parentUser = await User.findOne({ telegramId: ctx.from.id });

  if (!teacher || !parentUser) {
    return ctx.reply("🛑 Could not complete booking. Please try again later.", parentMenu);
  }

  const parentUsername = ctx.from.username ? '@' + ctx.from.username : parentUser.name;

  const student = await Student.findOne({ parentId: parentUser.telegramId });
  const studentInfo = student
    ? `${student.name} (ID: ${student.studentId})`
    : 'No student linked';

  const subject = ctx.scene.session.subject;

  await ctx.telegram.sendMessage(
    teacher.telegramId,
    `📢 <b>New Tutoring Request</b>\n\n` +
    `👤 <b>Parent:</b> ${parentUser.name} (${parentUsername})\n` +
    `🆔 Parent Telegram ID: ${parentUser.telegramId}\n` +
    `🎓 <b>Student:</b> ${studentInfo}\n` +
    `📚 <b>Subject:</b> ${subject}\n\n` +
    `Do you accept this tutoring request?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Accept', callback_data: `tutor_accept_${ctx.from.id}_${teacher.teacherId}_${subject}` },
            { text: '🛑 Ignore', callback_data: `tutor_ignore_${ctx.from.id}_${teacher.teacherId}_${subject}` }
          ]
        ]
      }
    }
  );

  await ctx.telegram.sendMessage(
    process.env.NOTIFY_ME,
    `📢 <b>Parent requested a tutor</b>\n\n` +
    `👩‍🏫 <b>Teacher:</b> ${teacher.name} (ID: ${teacher.teacherId})\n` +
    `🆔 Teacher Telegram ID: ${teacher.telegramId}\n\n` +
    `👤 <b>Parent:</b> ${parentUser.name} (${parentUsername})\n` +
    `🆔 Parent Telegram ID: ${parentUser.telegramId}\n\n` +
    `🎓 <b>Student:</b> ${studentInfo}\n` +
    `📚 <b>Subject:</b> ${subject}\n` +
    `📅 Time: ${new Date().toLocaleString()}`,
    { parse_mode: 'HTML' }
  );

  ctx.reply('✅ Tአስተማሪ ቦታ ማስያዝ ጥያቄ ተልኳል! እባክዎ ምላሹን በትዕግስት ይጠብቁ።' , parentMenuAm);
  ctx.scene.leave();
});
  

parentRequestTutorSceneAm.action('cancel_am', async (ctx) => {
  ctx.reply('🛑 ተው።', parentMenuAm);
  ctx.scene.leave();
});

stage.register(parentRequestTutorSceneAm);


/////////////////////////-----------------------------END OF AMHARIC------------------------------




const teacherManageFreelanceScene = new Scenes.BaseScene('teacher_manage_freelance_scene');
const cancelKey = Markup.keyboard([['🛑 Cancel']]).resize().oneTime();

teacherManageFreelanceScene.enter(async (ctx) => {
    

 await ctx.reply('...', cancelKeyboard);

  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) return ctx.reply('🛑 Not a teacher.');

  const offers = await FreelanceOffer.find({ teacherId: teacher.teacherId });
if (offers.length === 0) {
    await ctx.reply('🛑 You have not registered any freelance offers yet.', teacherMenu);
    return ctx.scene.leave(); 
}


  let message = `📜 <b>Your Freelance Offers</b>\n\n`;
  const buttons = [];

  offers.forEach((o, idx) => {
    message += `${idx + 1}. 📚 ${o.subject}\n`;
    message += `   💰 ${o.salaryPerHour}/hr | ⏱ ${o.hoursPerDay}h/day | 📅 ${o.daysPerWeek}d/week\n\n`;

    buttons.push([
      Markup.button.callback(`✏️ Edit (${o.subject})`, `edit_offer_${o._id}`),
      Markup.button.callback(`🗑 Remove`, `remove_offer_${o._id}`)
    ]);
  });

  ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));
});
teacherManageFreelanceScene.hears('🛑 Cancel', async (ctx) => {
  await ctx.reply('Cancelled.', teacherMenu);
  ctx.scene.leave();
});
teacherManageFreelanceScene.action(/^remove_offer_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const offerId = ctx.match[1];
  await FreelanceOffer.deleteOne({ _id: offerId });

  await ctx.reply('🗑 Offer removed successfully.', teacherMenu);
  ctx.scene.leave();
});
teacherManageFreelanceScene.action(/^edit_offer_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const offerId = ctx.match[1];
  ctx.scene.session.editOfferId = offerId;

  ctx.reply('✏️ Enter new salary per hour:');
  ctx.scene.session.state = 'edit_salary';
});

teacherManageFreelanceScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (ctx.scene.session.state === 'edit_salary') {
    ctx.scene.session.salary = Number(text);
    ctx.reply('⏱ Enter new hours per day:');
    ctx.scene.session.state = 'edit_hours';

  } else if (ctx.scene.session.state === 'edit_hours') {
    ctx.scene.session.hours = Number(text);
    ctx.reply('📅 Enter new days per week:');
    ctx.scene.session.state = 'edit_days';

  } else if (ctx.scene.session.state === 'edit_days') {
    ctx.scene.session.days = Number(text);

    const { salary, hours, days, editOfferId } = ctx.scene.session;
    await FreelanceOffer.updateOne(
      { _id: editOfferId },
      { $set: { salaryPerHour: salary, hoursPerDay: hours, daysPerWeek: days } }
    );

    ctx.reply('✅ Freelance offer updated successfully!', teacherMenu);
    ctx.scene.leave();
  }
});


stage.register(teacherManageFreelanceScene);

// Teacher Freelance Registration Scene
const teacherFreelanceScene = new Scenes.BaseScene('teacher_freelance_scene');
const freelanceTeacherAgreement = `
📜 Freelance Teacher Agreement Disclosure

By registering as a freelance teacher on this platform, you automatically agree to the following terms:

• A service fee of 11% will be deducted from your earnings per transaction.
• This fee is allocated to the developer for ongoing platform development, maintenance, and support.
• Your continued use of the platform constitutes acceptance of this fee structure.

Please ensure you have read and understood this disclosure before completing your registration.
`;
teacherFreelanceScene.enter(async (ctx) => {
  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  if (!teacher) return ctx.reply('🛑 Not a teacher.');
  const buttons = teacher.subjects.map(s =>
    [Markup.button.callback(s, `subject_${s}`)]
  );
  ctx.reply(freelanceTeacherAgreement, Markup.keyboard([['🛑 Cancel']]).resize());
  ctx.reply('📚 Select subject:', Markup.inlineKeyboard(buttons));
});

teacherFreelanceScene.action(/^subject_(.+)$/, async (ctx) => {
  ctx.scene.session.subject = ctx.match[1];
  ctx.reply('💰 Enter salary per hour:');
  ctx.scene.session.state = 'salary';
});

teacherFreelanceScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  if (text === '🛑 Cancel') {
    ctx.reply('🛑 Cancelled.', teacherMenu);
    return ctx.scene.leave();
  }
  if (ctx.scene.session.state === 'salary') {
    ctx.scene.session.salary = Number(text);
    ctx.reply('⏱ Enter hours per day:');
    ctx.scene.session.state = 'hours';
  } else if (ctx.scene.session.state === 'hours') {
    ctx.scene.session.hours = Number(text);
    ctx.reply('📅 Enter days per week:');
    ctx.scene.session.state = 'days';
  } else if (ctx.scene.session.state === 'days') {
    ctx.scene.session.days = Number(text);
    const { subject, salary, hours, days } = ctx.scene.session;
    ctx.reply(
      `📋 Confirm:\nSubject: ${subject}\n💰 ${salary}/hr\n⏱ ${hours} hrs/day\n📅 ${days} days/week`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Confirm', 'confirm')],
        [Markup.button.callback('🛑 Cancel', 'cancel')]
      ])
    );
  }
});

teacherFreelanceScene.action('confirm', async (ctx) => {
  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  const offer = new FreelanceOffer({
    teacherId: teacher.teacherId,
    subject: ctx.scene.session.subject,
    salaryPerHour: ctx.scene.session.salary,
    hoursPerDay: ctx.scene.session.hours,
    daysPerWeek: ctx.scene.session.days
  });

  await offer.save();

  ctx.reply('✅ Freelance offer saved!', teacherMenu);

  try {
    await ctx.telegram.sendMessage(
      process.env.NOTIFY_ME,
      `📢 <b>New Freelance Offer Registered</b>\n\n` +
      `👩‍🏫 <b>Teacher:</b> ${teacher.name} (ID: ${teacher.teacherId})\n` +
      `🆔 Teacher Telegram ID: ${teacher.telegramId}\n\n` +
      `📚 <b>Subject:</b> ${offer.subject}\n` +
      `💰 <b>Salary:</b> ${offer.salaryPerHour}/hour\n` +
      `⏱ <b>Hours per day:</b> ${offer.hoursPerDay}\n` +
      `📅 <b>Days per week:</b> ${offer.daysPerWeek}\n` +
      `🕒 Registered: ${new Date().toLocaleString()}`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Failed to notify NOTIFY_ME about freelance offer:', err);
  }

  ctx.scene.leave();
});
 

stage.register(teacherFreelanceScene);


//parent request tutor scene

const parentRequestTutorScene = new Scenes.BaseScene('parent_request_tutor_scene');

parentRequestTutorScene.enter(async (ctx) => {
  const subjects = await Teacher.distinct('subjects');
  const buttons = subjects.flat().map(s => [Markup.button.callback(s, `subj_${s}`)]);
  ctx.reply('📚 Select subject:', Markup.inlineKeyboard(buttons));
});

parentRequestTutorScene.action(/^subj_(.+)$/, async (ctx) => {
  const subject = ctx.match[1];
  ctx.scene.session.subject = subject;

  const offers = await FreelanceOffer.find({ subject });

  if (offers.length === 0) {
    return ctx.reply('🛑 No freelance tutors available for this subject.');
  }

  const teacherIds = offers.map(o => o.teacherId);
  const teachers = await Teacher.find({ teacherId: { $in: teacherIds } });

  const buttons = offers.map(o => {
    const t = teachers.find(tt => tt.teacherId === o.teacherId);
    if (!t) return null;
    return [Markup.button.callback(
      `${t.name} — 💰${o.salaryPerHour}/hr | ⏱${o.hoursPerDay}h/day | 📅${o.daysPerWeek}d/week`,
      `teach_${t.teacherId}`
    )];
  }).filter(Boolean);

  ctx.editMessageText(`👩‍🏫 Freelance Tutors for ${subject}`, Markup.inlineKeyboard(buttons));
});


parentRequestTutorScene.action(/^teach_(.+)$/, async (ctx) => {
  ctx.scene.session.teacherId = ctx.match[1];
  ctx.reply(
    '📋 Confirm booking this tutor?',
    Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm', 'confirm')],
      [Markup.button.callback('🛑 Cancel', 'cancel')]
    ])
  );
});

parentRequestTutorScene.action('confirm', async (ctx) => {
  const teacher = await Teacher.findOne({ teacherId: ctx.scene.session.teacherId });
  const parentUser = await User.findOne({ telegramId: ctx.from.id });

  if (!teacher || !parentUser) {
    return ctx.reply("🛑 Could not complete booking. Please try again later.", parentMenu);
  }

  const parentUsername = ctx.from.username ? '@' + ctx.from.username : parentUser.name;

  const student = await Student.findOne({ parentId: parentUser.telegramId });
  const studentInfo = student
    ? `${student.name} (ID: ${student.studentId})`
    : 'No student linked';

  const subject = ctx.scene.session.subject;

  await ctx.telegram.sendMessage(
    teacher.telegramId,
    `📢 <b>New Tutoring Request</b>\n\n` +
    `👤 <b>Parent:</b> ${parentUser.name} (${parentUsername})\n` +
    `🆔 Parent Telegram ID: ${parentUser.telegramId}\n` +
    `🎓 <b>Student:</b> ${studentInfo}\n` +
    `📚 <b>Subject:</b> ${subject}\n\n` +
    `Do you accept this tutoring request?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Accept', callback_data: `tutor_accept_${ctx.from.id}_${teacher.teacherId}_${subject}` },
            { text: '🛑 Ignore', callback_data: `tutor_ignore_${ctx.from.id}_${teacher.teacherId}_${subject}` }
          ]
        ]
      }
    }
  );

  await ctx.telegram.sendMessage(
    process.env.NOTIFY_ME,
    `📢 <b>Parent requested a tutor</b>\n\n` +
    `👩‍🏫 <b>Teacher:</b> ${teacher.name} (ID: ${teacher.teacherId})\n` +
    `🆔 Teacher Telegram ID: ${teacher.telegramId}\n\n` +
    `👤 <b>Parent:</b> ${parentUser.name} (${parentUsername})\n` +
    `🆔 Parent Telegram ID: ${parentUser.telegramId}\n\n` +
    `🎓 <b>Student:</b> ${studentInfo}\n` +
    `📚 <b>Subject:</b> ${subject}\n` +
    `📅 Time: ${new Date().toLocaleString()}`,
    { parse_mode: 'HTML' }
  );

  ctx.reply('✅ Tutor booking request sent! Please wait for the response patiently.', parentMenu);
  ctx.scene.leave();
});



stage.register(parentRequestTutorScene);


// --- Manage Grades Scene ---
const manageGradesScene = new Scenes.BaseScene('manage_grades_scene');

const cancelKeyboard = Markup.keyboard([
  ['🛑 Cancel']
]).resize();

const getTeacherClasses = async (teacherId) => {
    try {
        const classes = await TeacherStudent.distinct('className', { teacherId });
        return classes.filter(className => className && className.trim() !== '');
    } catch (err) {
        console.error('Error getting teacher classes:', err);
        return [];
    }
};

const getTeacherSubjects = async (teacherId, className) => {
    try {
        const subjects = await TeacherStudent.distinct('subject', { teacherId, className });
        return subjects.filter(subject => subject && subject.trim() !== '');
    } catch (err) {
        console.error('Error getting teacher subjects:', err);
        return [];
    }
};

const PAGE_SIZE = 10;

manageGradesScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            ctx.reply('🛑 You are not registered as a teacher. Please contact your administrator.');
            return ctx.scene.leave();
        }
        ctx.scene.session.teacherId = teacher.teacherId;

        const classes = await getTeacherClasses(teacher.teacherId);

        if (classes.length === 0) {
            ctx.reply('🛑 You have not been linked to any classes. Please contact your administrator.');
            return ctx.scene.leave();
        }

        const buttons = classes.map(c => [Markup.button.callback(c, `select_class_${c.replace(/ /g, '_')}`)]);

        ctx.reply('🏫 Select a class to manage grades:', Markup.inlineKeyboard(buttons));

        ctx.reply('Manage Grades Menu.',cancelKeyboard);
    } catch (error) {
        console.error('Error in manage grades scene (enter):', error);
        ctx.reply('🛑 An error occurred. Please try again.');
        ctx.scene.leave();
    }
});

manageGradesScene.action(/^select_class_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const className = ctx.match[1].replace(/_/g, ' ');
    ctx.scene.session.className = className;
    ctx.scene.session.subject = null;

    const teacherId = ctx.scene.session.teacherId;
    const subjects = await getTeacherSubjects(teacherId, className);

    if (subjects.length === 0) {
        return ctx.reply(`🛑 No subjects found for class "${className}".`);
    }

    const buttons = subjects.map(s => [Markup.button.callback(s, `select_subject_${s.replace(/ /g, '_')}`)]);
    buttons.push([Markup.button.callback('⬅️ Back to Classes', 'back_to_classes')]);

    ctx.editMessageText(`📚 Select a subject for class "${className}":`, Markup.inlineKeyboard(buttons));
});

manageGradesScene.action('back_to_classes', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.scene.session.className;
    ctx.scene.reenter();
});

manageGradesScene.action(/^select_subject_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const subject = ctx.match[1].replace(/_/g, ' ');
    ctx.scene.session.subject = subject;
    ctx.scene.session.page = 1;

    await displayList(ctx);
});

const displayList = async (ctx) => {
    const { className, subject, page = 1, teacherId } = ctx.scene.session;

    const students = await TeacherStudent.find({
        teacherId,
        className,
        subject
    }).sort({ studentName: 1 });

    const totalStudents = students.length;
    const offset = (page - 1) * PAGE_SIZE;
    const studentsOnPage = students.slice(offset, offset + PAGE_SIZE);

    if (studentsOnPage.length === 0) {
        await ctx.editMessageText('🛑 No students found for this subject.', Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Subjects', 'back_to_subjects')]
        ]));
        return;
    }

    let message = `📝 Students in ${className} - ${subject} (Page ${page}/${Math.ceil(totalStudents / PAGE_SIZE)})\n\n`;
    const studentButtons = studentsOnPage.map(student => [
        Markup.button.callback(`${student.studentName} (${student.studentId})`, `select_student_${student.studentId}`)
    ]);

    const paginationButtons = [];
    if (page > 1) {
        paginationButtons.push(Markup.button.callback('⬅️ Previous', 'prev_page'));
    }
    if (page * PAGE_SIZE < totalStudents) {
        paginationButtons.push(Markup.button.callback('Next ➡️', 'next_page'));
    }

    const keyboard = Markup.inlineKeyboard([
        ...studentButtons,
        paginationButtons,
        [Markup.button.callback('⬅️ Back to Subjects', 'back_to_subjects')]
    ]);

    await ctx.editMessageText(message, keyboard);
};

manageGradesScene.action('prev_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.session.page--;
    await displayList(ctx);
});

manageGradesScene.action('next_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.session.page++;
    await displayList(ctx);
});

manageGradesScene.action('back_to_subjects', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.scene.session.page;
    ctx.scene.reenter();
});

manageGradesScene.action(/^select_student_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const studentId = ctx.match[1];
    ctx.scene.session.studentId = studentId;

    const student = await Student.findOne({ studentId });
    if (!student) {
        return ctx.reply('🛑 Student not found.');
    }

    const buttons = [
        [Markup.button.callback('➕ Add Grade', 'add_grade')],
        [Markup.button.callback('✏️ Edit/View Grades', 'edit_view_grades')],
        [Markup.button.callback('🗑️ Delete Grades', 'delete_grade_menu')],
        [Markup.button.callback('🎓 Letter Grading', 'letter_grading_menu')],
        [Markup.button.callback('⬅️ Back to Students', 'back_to_students')]
    ];

    ctx.editMessageText(`Selected student: ${student.name}\n\nWhat would you like to do?`, Markup.inlineKeyboard(buttons));
});


manageGradesScene.action('letter_grading_menu', async (ctx) => {
  await ctx.answerCbQuery();

  const letterButtons = [
    [
      Markup.button.callback('A+', 'grade_Aplus'),
      Markup.button.callback('A', 'grade_A'),
      Markup.button.callback('A-', 'grade_Aminus')
    ],
    [
      Markup.button.callback('B+', 'grade_Bplus'),
      Markup.button.callback('B', 'grade_B'),
      Markup.button.callback('B-', 'grade_Bminus')
    ],
    [
      Markup.button.callback('C+', 'grade_Cplus'),
      Markup.button.callback('C', 'grade_C'),
      Markup.button.callback('C-', 'grade_Cminus')
    ],
    [
      Markup.button.callback('D', 'grade_D'),
      Markup.button.callback('F', 'grade_F')
    ],
    [Markup.button.callback('⬅️ Back', 'back_to_student_menu')]
  ];

  await ctx.editMessageText(
    `🎓 <b>Letter Grading</b>\n\nSelect a grade to assign to the student.`,
    { parse_mode: 'HTML', reply_markup: Markup.inlineKeyboard(letterButtons).reply_markup }
  );
});

// --- HANDLE LETTER GRADE SELECTION (with parent notification) ---
manageGradesScene.action(/^grade_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const letterGrade = ctx.match[1]
    .replace('plus', '+')
    .replace('minus', '-')
    .toUpperCase();

  const studentId = ctx.scene.session.studentId;
  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

  if (!studentId || !teacher) {
    return ctx.reply('⚠️ Missing student or teacher info.');
  }

  const student = await Student.findOne({ studentId });
  if (!student) return ctx.reply('🛑 Student not found.');

  const gradeId = await generateUniqueGradeId();
  const newGrade = new Grade({
    gradeId,
    studentId: student.studentId,
    studentName: student.name,
    teacherId: teacher.teacherId,
    teacherName: teacher.name,
    subject: ctx.scene.session.subject || 'General',
    score: letterGrade,
    purpose: 'Letter Grade',
    date: new Date(),
  });

  await newGrade.save();

  await ctx.editMessageText(
    `✅ Letter grade <b>${letterGrade}</b> assigned successfully to <b>${student.name}</b>.`,
    { parse_mode: 'HTML' }
  );

  try {
    if (student.parentId) {
      const parentUser = await User.findOne({ telegramId: student.parentId });
      if (parentUser) {
        const message = `
📢 <b>New Grade Notification</b>

👩‍🏫 <b>Teacher:</b> ${teacher.name}
🎓 <b>Student:</b> ${student.name} (${student.studentId})
📚 <b>Subject:</b> ${ctx.scene.session.subject || 'General'}
🏆 <b>Letter Grade:</b> ${letterGrade}
🕒 <b>Date:</b> ${new Date().toLocaleString()}

Keep encouraging your child! 💪
        `;

        await ctx.telegram.sendMessage(parentUser.telegramId, message, { parse_mode: 'HTML' });
      } else {
        console.warn(`⚠️ Parent user record not found for student ${studentId}`);
      }
    } else {
      console.warn(`ℹ️ No parent linked for student ${studentId}`);
    }
  } catch (error) {
    console.error(`🛑 Failed to notify parent of ${student.name}:`, error);
  }

  
});


manageGradesScene.action('back_to_students', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.scene.session.studentId;
    await displayList(ctx);
});

manageGradesScene.action('add_grade', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.session.state = 'add_grade_awaiting_purpose';
    ctx.reply('📝 Please enter the purpose of the grade (e.g., "Midterm Exam").');
});


manageGradesScene.on('text', async (ctx) => {
    const text = ctx.message.text;

    if (text === '🛑 Cancel') {
        ctx.reply('✅ Action cancelled. Returning to the main menu.', teacherMenu);
        return ctx.scene.leave();
    }

    const currentState = ctx.scene.session.state;

    if (currentState === 'add_grade_awaiting_purpose') {
        const purpose = text.trim();
        if (purpose.length > 100) {
            return ctx.reply('🛑 Purpose is too long. Please keep it under 100 characters.');
        }
        ctx.scene.session.tempPurpose = purpose;
        ctx.scene.session.state = 'add_grade_awaiting_score';
        ctx.reply('💯 Now, enter the score (0-100).');
    } else if (currentState === 'add_grade_awaiting_score') {
        const score = parseFloat(text.trim());
        if (isNaN(score) || score < 0 || score > 100) {
            return ctx.reply('🛑 Invalid score. Please enter a number between 0 and 100.');
        }
        ctx.scene.session.tempScore = score;
        ctx.scene.session.state = 'add_grade_awaiting_comments';
        ctx.reply('✍️ Add any comments (optional, or type "none").');
    } else if (currentState === 'add_grade_awaiting_comments') {
        const comments = text.trim().toLowerCase() === 'none' ? '' : text.trim();
        const { studentId, subject, tempPurpose, tempScore, teacherId } = ctx.scene.session;

        const student = await Student.findOne({ studentId });
        const teacher = await Teacher.findOne({ teacherId });

        if (!student || !teacher) {
            ctx.reply('🛑 Unable to find student or teacher data. Please try again.');
            return ctx.scene.leave();
        }

        try {
            const gradeId = await generateUniqueGradeId();
            const newGrade = new Grade({
                gradeId,
                studentId,
                studentName: student.name,
                teacherId: teacher.teacherId,
                teacherName: teacher.name,
                subject,
                score: tempScore,
                purpose: tempPurpose,
                date: new Date().toISOString(),
                comments: comments.substring(0, 500)
            });
            await newGrade.save();
            ctx.reply(`✅ Grade added successfully for ${student.name}!\n\n` +
                      `Purpose: ${tempPurpose}\n` +
                      `Score: ${tempScore}\n` +
                      `Comments: ${comments || 'None'}`,
                Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back to Students', 'back_to_students')]])
            );

    if (student.parentId) {
    const parent = await User.findOne({ telegramId: student.parentId, role: 'parent' });
    if (parent && parent.telegramId) {
        const parentNotification = `🔔 New Grade Alert\n\n` +
                                  `A new grade has been recorded for your child, ${student.name}.\n\n` +
                                  `Subject: ${subject}\n` +
                                  `Purpose: ${tempPurpose}\n` +
                                  `Score: ${tempScore}\n` +
                                  `Comments: ${comments || 'None'}\n` +
                                  `Recorded Date: ${new Date(newGrade.date).toLocaleDateString()}\n` +
                                  `Teacher: ${teacher.name}`;
        try {
            await ctx.telegram.sendMessage(parent.telegramId, parentNotification, { parse_mode: 'HTML' });
        } catch (sendError) {
            console.error(`Failed to send message to parent ${parent.telegramId}:`, sendError);
        }
    } 
}
if (student.parentId) {
    const parentAm = await User.findOne({ telegramId: student.parentId, role: 'parentAm' });
    if (parentAm && parentAm.telegramId) {
        const parentNotification = `🔔 አዲስ ውጤት:\n\n` +
                                  `ለልጅዎ፣ ${student.name}፣ አዲስ ውጤት ተመዝግቧል።\n\n` +
                                  `የትምህርት አይነት: ${subject}\n` +
                                  `ዓላማ: ${tempPurpose}\n` +
                                  `ውጤት: ${tempScore}\n` +
                                  `አስተያየቶች: ${comments || 'የለም'}\n` +
                                  `የተመዘገበበት ቀን: ${new Date(newGrade.date).toLocaleDateString()}\n` +
                                  `አስተማሪ: ${teacher.name}`;
        try {
            await ctx.telegram.sendMessage(parentAm.telegramId, parentNotification, { parse_mode: 'HTML' });
        } catch (sendError) {
            console.error(`Failed to send message to parent ${parentAm.telegramId}:`, sendError);
        }
    } 
}

} catch (error) {
    console.error('Error adding grade:', error);
    ctx.reply('🛑 An error occurred while saving the grade. Please try again.');
}
delete ctx.scene.session.state;
delete ctx.scene.session.tempPurpose;
delete ctx.scene.session.tempScore;
} else if (currentState === 'edit_awaiting_new_value') {
    const newValue = text.trim();
    const { gradeToEdit, fieldToEdit } = ctx.scene.session;
    const grade = await Grade.findOne({ gradeId: gradeToEdit });

    if (!grade) {
        return ctx.reply('🛑 Grade not found.');
    }

    try {
        if (fieldToEdit === 'score') {
            const score = parseFloat(newValue);
            if (isNaN(score) || score < 0 || score > 100) {
                return ctx.reply('🛑 Invalid score. Please enter a number between 0 and 100.');
            }
            grade.score = score;
        } else if (fieldToEdit === 'purpose') {
            grade.purpose = newValue.substring(0, 100);
        } else if (fieldToEdit === 'comments') {
            grade.comments = newValue.substring(0, 500);
        }
        
        await grade.save();
        ctx.reply(`✅ Grade ${fieldToEdit} updated successfully!`, Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Students', 'back_to_students')]
        ]));

        const comments = text.trim().toLowerCase() === 'none' ? '' : text.trim();
        const { studentId, subject, tempPurpose, tempScore, teacherId } = ctx.scene.session;
        const teacher = await Teacher.findOne({ teacherId });

        const student = await Student.findOne({ studentId });


        if (student.parentId) {
    const parent = await User.findOne({ telegramId: student.parentId, role: 'parent' });
    if (parent && parent.telegramId) {
        const parentNotification = `🔔 Modified Grade Alert\n\n` +
                                  `A grade has been modified for your child, ${student.name}.\n\n` +
                                  `Subject: ${subject}\n` +
                                  `Purpose: ${grade.purpose}\n` +
                                  `Score: ${grade.score}\n` +
                                    `Comments: ${grade.comments || 'None'}\n` +
                                  `Recorded Date: ${new Date().toLocaleDateString()}\n` +
                                  `Teacher: ${teacher.name}`;
        try {
            await ctx.telegram.sendMessage(parent.telegramId, parentNotification, { parse_mode: 'HTML' });
        } catch (sendError) {
            console.error(`Failed to send message to parent ${parent.telegramId}:`, sendError);
        }
    } 
}

    if (student.parentId) {
    const parentAm = await User.findOne({ telegramId: student.parentId, role: 'parentAm' });
    if (parentAm && parentAm.telegramId) {
        const parentNotification = `🔔 የለውጥ ማሳሰቢያ\n\n` +
                                  `የልጅዎ የ${student.name} ውጤት ላይ ለውጥ ተደርጓል።\n\n` +
                                  `ትምህርት: ${subject}\n` +
                                  `ዓላማ: ${grade.purpose}\n` +
                                  `ውጤት: ${grade.score}\n` +
                                  `ማስታወሻ: ${grade.comments || 'የለም'}\n` +
                                  `የተመዘገበበት ቀን: ${new Date().toLocaleDateString()}\n` +
                                  `መምህር: ${teacher.name}`;
        try {
            await ctx.telegram.sendMessage(parentAm.telegramId, parentNotification, { parse_mode: 'HTML' });
        } catch (sendError) {
            console.error(`Failed to send message to parent ${parent.telegramId}:`, sendError);
        }
    } 
}
        
    } catch (error) {
        console.error('Error updating grade:', error);
        ctx.reply('🛑 An error occurred while updating the grade.');
    }
    
    delete ctx.scene.session.state;
    delete ctx.scene.session.fieldToEdit;
    delete ctx.scene.session.gradeToEdit;
} else {
    ctx.reply('🛑 I am currently waiting for you to select a button. Please use the inline buttons to navigate or type /cancel to go back.');
}
});

function formatDateSafe(value, locale = 'en-US') {
  if (!value) return 'Unknown Date';
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return 'Unknown Date';
    return date.toLocaleDateString(locale);
  } catch {
    return 'Unknown Date';
  }
}

manageGradesScene.action('edit_view_grades', async (ctx) => {

    await ctx.answerCbQuery();
    const { studentId, subject } = ctx.scene.session;
    const grades = await Grade.find({ studentId, subject }).sort({ date: -1 });

    if (grades.length === 0) {
        return ctx.reply('🛑 No grades found for this student and subject.', Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]
        ]));
    }

    let message = `📋 Grades for ${grades[0].studentName} in ${subject}:\n\n`;

    const gradeButtons = grades.map((grade, index) => {
        const dateStr = formatDateSafe(grade.date); 
        message += `${index + 1}. ${grade.purpose}: ${grade.score}\n` +
                   `   Date: ${dateStr}\n`;
        return [Markup.button.callback(`✏️ Edit Grade ${index + 1}`, `edit_grade_${grade.gradeId}`)];
    });

    gradeButtons.push([Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]);

    ctx.editMessageText(message, { 
        ...Markup.inlineKeyboard(gradeButtons), 
        parse_mode: 'Markdown' 
    });
});

manageGradesScene.action('back_to_student_actions', async (ctx) => {
    await ctx.answerCbQuery();
    const studentId = ctx.scene.session.studentId;
    const student = await Student.findOne({ studentId });

    const buttons = [
        [Markup.button.callback('➕ Add Grade', 'add_grade')],
        [Markup.button.callback('✏️ Edit/View Grades', 'edit_view_grades')],
        [Markup.button.callback('🗑️ Delete Grades', 'delete_grade_menu')],
        [Markup.button.callback('⬅️ Back to Students', 'back_to_students')]
    ];

    ctx.editMessageText(`Selected student: ${student.name}\n\nWhat would you like to do?`, Markup.inlineKeyboard(buttons));
});

manageGradesScene.action(/^edit_grade_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const gradeId = ctx.match[1];
    const grade = await Grade.findOne({ gradeId });

    if (!grade) {
        return ctx.reply('🛑 Grade not found.');
    }

    ctx.scene.session.gradeToEdit = gradeId;
    ctx.scene.session.state = 'edit_awaiting_field';

    const message = `✏️ Editing Grade for ${grade.studentName}\n\n` +
                    `Purpose: ${grade.purpose}\n` +
                    `Score: ${grade.score}\n` +
                    `Comments: ${grade.comments || 'None'}\n\n` +
                    `Select a field to edit:`;

    const buttons = [
        [Markup.button.callback('Purpose', 'edit_field_purpose')],
        [Markup.button.callback('Score', 'edit_field_score')],
        [Markup.button.callback('Comments', 'edit_field_comments')],
        [Markup.button.callback('⬅️ Back to Students', 'back_to_student_actions')]
    ];

    ctx.editMessageText(message, { ...Markup.inlineKeyboard(buttons), parse_mode: 'Markdown' });
});

manageGradesScene.action(/^edit_field_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const field = ctx.match[1];
    ctx.scene.session.fieldToEdit = field;
    ctx.scene.session.state = 'edit_awaiting_new_value';
    ctx.reply(`Please enter the new value for ${field}.`);
});

manageGradesScene.action('cancel_edit', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.scene.session.state;
    delete ctx.scene.session.fieldToEdit;
    delete ctx.scene.session.gradeToEdit;
    ctx.reply('🛑 Grade editing cancelled.', Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]
    ]));
});

manageGradesScene.action('delete_grade_menu', async (ctx) => {
    await ctx.answerCbQuery();
    const { studentId, subject } = ctx.scene.session;
    const grades = await Grade.find({ studentId, subject }).sort({ date: -1 });

    if (grades.length === 0) {
        return ctx.reply('🛑 No grades to delete.', Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]
        ]));
    }

    const message = `⚠️ Select a grade to permanently delete:\n\n`;
    const gradeButtons = grades.map((grade, index) => {
        return [Markup.button.callback(`${grade.purpose} (${grade.score})`, `confirm_delete_grade_${grade.gradeId}`)];
    });

    gradeButtons.push([Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]);

    ctx.editMessageText(message, { ...Markup.inlineKeyboard(gradeButtons), parse_mode: 'Markdown' });
});

manageGradesScene.action(/^confirm_delete_grade_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const gradeId = ctx.match[1];
    ctx.scene.session.gradeToDelete = gradeId;

    const message = `Are you sure you want to permanently delete this grade?\n\n` +
                    `This action cannot be undone.`;

    const buttons = [
        [Markup.button.callback('✅ Confirm Delete', `delete_confirmed_${gradeId}`)],
        [Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]
    ];

    ctx.editMessageText(message, { ...Markup.inlineKeyboard(buttons), parse_mode: 'Markdown' });
});

manageGradesScene.action(/^delete_confirmed_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const gradeId = ctx.match[1];

    try {
        const result = await Grade.deleteOne({ gradeId });
        if (result.deletedCount > 0) {
            ctx.reply('🗑️ Grade successfully deleted!', Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Back to Student Actions', 'back_to_student_actions')]
            ]));
        } else {
            ctx.reply('🛑 Grade not found or already deleted.');
        }
    } catch (error) {
        console.error('Error deleting grade:', error);
        ctx.reply('🛑 An error occurred while deleting the grade. Please try again.');
    }
});

stage.register(manageGradesScene);

//TEACHER REMINDER  Scene
const teacherReminderScene = new Scenes.BaseScene('teacher_reminder_scene');

teacherReminderScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            return ctx.reply('🛑 Teacher profile not found.', teacherMenu);
        }

        let teacherSettings = await TeacherSettings.findOne({ teacherId: teacher.teacherId });
        if (!teacherSettings) {
            teacherSettings = new TeacherSettings({ teacherId: teacher.teacherId });
            await teacherSettings.save();
        }

        const reminderStatus = teacherSettings.attendanceReminder ? '✅ ON' : '🛑 OFF';
        const message = `🔔 Attendance Reminders\n\n` +
                        `Your reminder is currently: ${reminderStatus}\n` +
                        `Reminder time: ${teacherSettings.reminderTime} (24-hour format)\n\n` +
                        `You can toggle the reminder or set a new time below.`;

        const buttons = [
            [Markup.button.callback(`🔄 Toggle Reminder (${reminderStatus})`, 'toggle_reminder')],
            [Markup.button.callback('⏰ Set Reminder Time', 'set_reminder_time')],
            [Markup.button.callback('🔙 Back to Attendance Menu', 'back_to_attendance')]
        ];

        ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));

    } catch (error) {
        console.error('Error in teacher reminder scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherReminderScene.action('toggle_reminder', async (ctx) => {
    await ctx.answerCbQuery();
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        let teacherSettings = await TeacherSettings.findOne({ teacherId: teacher.teacherId });

        if (!teacherSettings) {
            teacherSettings = new TeacherSettings({ teacherId: teacher.teacherId });
        }

        teacherSettings.attendanceReminder = !teacherSettings.attendanceReminder;
        await teacherSettings.save();

        await ctx.reply(`✅ Attendance reminder is now ${teacherSettings.attendanceReminder ? 'ON' : 'OFF'}.`, Markup.removeKeyboard());
        ctx.scene.reenter();
    } catch (error) {
        console.error('Error toggling reminder:', error);
        ctx.reply('🛑 An error occurred while toggling the reminder. Please try again.');
    }
});

teacherReminderScene.action('set_reminder_time', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('📝 Please enter the new reminder time in 24-hour format (e.g., 08:30 or 15:00).');
    ctx.scene.session.state = 'awaiting_time';
});

teacherReminderScene.on('text', async (ctx) => {
    if (ctx.scene.session.state === 'awaiting_time') {
        const time = ctx.message.text.trim();
        const timeRegex = /^(?:2[0-3]|[01]?[0-9]):(?:[0-5]?[0-9])$/;
        
        if (!timeRegex.test(time)) {
            return ctx.reply('🛑 Invalid time format. Please use HH:mm (e.g., 08:30).');
        }

        try {
            const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
            let teacherSettings = await TeacherSettings.findOne({ teacherId: teacher.teacherId });

            if (!teacherSettings) {
                teacherSettings = new TeacherSettings({ teacherId: teacher.teacherId });
            }

            teacherSettings.reminderTime = time;
            await teacherSettings.save();

            ctx.reply(`✅ Reminder time updated to ${time}.`, Markup.removeKeyboard());
            delete ctx.scene.session.state;
            ctx.scene.reenter();
        } catch (error) {
            console.error('Error setting reminder time:', error);
            ctx.reply('🛑 An error occurred while setting the time. Please try again.');
            delete ctx.scene.session.state;
            ctx.scene.reenter();
        }
    } else {
        ctx.reply('Please exit the attendance recording tab first by clicking "Back to attendance menu ---> cancel.');
    }
});

teacherReminderScene.action('back_to_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.scene.session.state;
    ctx.scene.leave();
    ctx.scene.enter('teacher_attendance_scene');
});

stage.register(teacherReminderScene);

const adminAnnounceByClassScene = new Scenes.BaseScene('admin_announce_by_class_scene');

adminAnnounceByClassScene.enter(async (ctx) => {
    try {
        const classes = await Student.distinct('class');
        if (!classes || classes.length === 0) {
            return ctx.reply('🛑 No classes found.', adminMenu);
        }

        const buttons = classes.map(c => [Markup.button.callback(c, `select_class_${c.replace(/ /g, '_')}`)]);
        buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_announce_class')]);

        ctx.reply('🏫 Select a class to send an announcement to:', Markup.inlineKeyboard(buttons));
    } catch (err) {
        console.error('Error loading classes:', err);
        ctx.reply('🛑 Error loading classes.', adminMenu);
        ctx.scene.leave();
    }
});

adminAnnounceByClassScene.action(/^select_class_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const className = ctx.match[1].replace(/_/g, ' ');
    ctx.session.announceClass = className;

    ctx.reply(
        `✍️ Send the message or media you want to broadcast to class: ${className}\n\n(Or click 🛑 Cancel to stop)`,
        Markup.keyboard([['🛑 Cancel']]).resize()
    );
});

adminAnnounceByClassScene.on('message', async (ctx) => {
    if (!ctx.session.announceClass) {
        ctx.reply('🛑 No class selected. Please start again.', adminMenu);
        return ctx.scene.leave();
    }

    if (ctx.message.text && ctx.message.text.trim() === '🛑 Cancel') {
        ctx.reply('🛑 Announcement cancelled.', adminMenu);
        delete ctx.session.announceClass;
        return ctx.scene.leave();
    }

    try {
        const className = ctx.session.announceClass;

        const students = await Student.find({ class: className });
        const parentIds = students.map(s => s.parentId).filter(Boolean);

        const teacherIds = await TeacherStudent.distinct('teacherId', { className });
        const teachers = await Teacher.find({ teacherId: { $in: teacherIds } });

        const parents = await User.find({ telegramId: { $in: parentIds } });
        const parentTgIds = parents.map(p => p.telegramId).filter(Boolean);
        const teacherTgIds = teachers.map(t => t.telegramId).filter(Boolean);

        const recipients = [...new Set([...parentTgIds, ...teacherTgIds])];

        let success = 0;
        for (const tgId of recipients) {
            try {
                if (ctx.message.text) {
                    await ctx.telegram.sendMessage(
                        tgId,
                        `📢 <b>Announcement for Class ${className}</b>\n\n${ctx.message.text}`,
                        { parse_mode: 'HTML' }
                    );
                } else if (ctx.message.photo) {
                    await ctx.telegram.sendPhoto(
                        tgId,
                        ctx.message.photo[ctx.message.photo.length - 1].file_id,
                        { caption: `📢 Announcement for Class ${className}`, parse_mode: 'HTML' }
                    );
                } else if (ctx.message.document) {
                    await ctx.telegram.sendDocument(
                        tgId,
                        ctx.message.document.file_id,
                        { caption: `📢 Announcement for Class ${className}`, parse_mode: 'HTML' }
                    );
                } else if (ctx.message.video) {
                    await ctx.telegram.sendVideo(
                        tgId,
                        ctx.message.video.file_id,
                        { caption: `📢 Announcement for Class ${className}`, parse_mode: 'HTML' }
                    );
                } else if (ctx.message.audio) {
                    await ctx.telegram.sendAudio(
                        tgId,
                        ctx.message.audio.file_id,
                        { caption: `📢 Announcement for Class ${className}`, parse_mode: 'HTML' }
                    );
                } else if (ctx.message.voice) {
                    await ctx.telegram.sendVoice(
                        tgId,
                        ctx.message.voice.file_id,
                        { caption: `📢 Announcement for Class ${className}`, parse_mode: 'HTML' }
                    );
                } else {
                    console.log('Unsupported media type, skipping recipient', tgId);
                    continue;
                }

                success++;
            } catch (e) {
                console.error('Failed to send to', tgId, e.message);
            }
        }

        ctx.reply(`✅ Announcement sent to ${success} recipients in class ${className}.`, adminMenu);

       
        await notifyMasterAdmin(ctx, 'class_announcement_sent', {
            className,
            recipientCount: success
        });

    } catch (err) {
        console.error('Error sending class announcement:', err);
        ctx.reply('🛑 Error sending announcement.', adminMenu);
    }

    delete ctx.session.announceClass;
    ctx.scene.leave();
});

adminAnnounceByClassScene.action('cancel_announce_class', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Announcement cancelled.', adminMenu);
    delete ctx.session.announceClass;
    ctx.scene.leave();
});

stage.register(adminAnnounceByClassScene);

// --- Record Attendance by Class Scene ---
const recordAttendanceByClassScene = new Scenes.BaseScene('record_attendance_by_class_scene');

recordAttendanceByClassScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            return ctx.reply('🛑 Teacher profile not found.', teacherMenu);
        }

        const classes = await TeacherStudent.distinct('className', { teacherId: teacher.teacherId });
        if (classes.length === 0) {
            return ctx.reply('🛑 You have no students linked to any class.', teacherMenu);
        }

        const buttons = classes.map(c => [Markup.button.callback(c, `select_class_${c.replace(/ /g, '_')}`)]);
        buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_class_attendance')]);

        ctx.reply('🏫 Select a class to record attendance for:', Markup.inlineKeyboard(buttons));
    } catch (error) {
        console.error('Error loading classes for attendance:', error);
        ctx.reply('🛑 Error loading classes.', teacherMenu);
        ctx.scene.leave();
    }
});

recordAttendanceByClassScene.action(/^select_class_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const className = ctx.match[1].replace(/_/g, ' ');

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const students = await TeacherStudent.find({ teacherId: teacher.teacherId, className }).sort({ studentName: 1 });

        if (students.length === 0) {
            return ctx.reply('🛑 No students found in this class.', teacherMenu);
        }

        ctx.session.attendanceClass = className;
        ctx.session.attendanceStudents = students.map(s => ({ ...s.toObject(), status: 'present' }));

        await displayClassAttendancePage(ctx, 0);

        

    } catch (error) {
        console.error('Error loading class students for attendance:', error);
        ctx.reply('🛑 Error loading students.', teacherMenu);
        ctx.scene.leave();
    }
});

recordAttendanceByClassScene.action('CANCEL_ATTENDANCE', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Attendance recording cancelled. Returning to Teacher Menu...', teacherMenu);
  await ctx.scene.leave();

  
});

const displayClassAttendancePage = async (ctx) => {
    const { attendanceStudents = [], attendancePage = 1 } = ctx.session;
    const PAGE_SIZE = 10;

    const totalStudents = attendanceStudents.length;
    const pageCount = Math.ceil(totalStudents / PAGE_SIZE);
    const start = (attendancePage - 1) * PAGE_SIZE;
    const studentsOnPage = attendanceStudents.slice(start, start + PAGE_SIZE);

    let message = `📝 Recording Attendance for Class: ${ctx.session.attendanceClass}\n`;
    message += `Page ${attendancePage}/${pageCount}\n\n`;

    studentsOnPage.forEach((s, index) => {
        const statusEmoji = s.status === 'present' ? '✅' : '🛑';
        message += `${start + index + 1}. ${s.studentName} (${s.studentId}) — ${statusEmoji}\n`;
    });

    const presentCount = attendanceStudents.filter(s => s.status === 'present').length;
    const absentCount = totalStudents - presentCount;
    message += `\n📊 Present: ${presentCount} | Absent: ${absentCount}\n`;

    const studentButtons = studentsOnPage.map(s => [
        Markup.button.callback(
            `${s.studentName} ${s.status === 'present' ? '✅' : '🛑'}`,
            `toggle_${s.studentId}`
        )
    ]);

    const navigationButtons = [];
    if (attendancePage > 1) {
        navigationButtons.push(Markup.button.callback('⬅️ Previous', 'page_prev'));
    }
    if (attendancePage < pageCount) {
        navigationButtons.push(Markup.button.callback('Next ➡️', 'page_next'));
    }

    studentButtons.push(navigationButtons);
    studentButtons.push([Markup.button.callback('📥 Submit Attendance', 'submit_attendance')]);

    if (ctx.session.attendanceMessageId) {
        try {
            await ctx.editMessageText(message, Markup.inlineKeyboard(studentButtons));
        } catch {
            const sent = await ctx.reply(message, Markup.inlineKeyboard(studentButtons));
            ctx.session.attendanceMessageId = sent.message_id;
        }
    } else {
        const sent = await ctx.reply(message, Markup.inlineKeyboard(studentButtons));
        ctx.session.attendanceMessageId = sent.message_id;
    }
};


recordAttendanceByClassScene.action(/^toggle_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const studentId = ctx.match[1];
    const student = ctx.session.attendanceStudents.find(s => s.studentId === studentId);
    if (student) {
        student.status = student.status === 'present' ? 'absent' : 'present';
    }
    await displayClassAttendancePage(ctx);
});

recordAttendanceByClassScene.action('page_prev', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.attendancePage = Math.max(1, (ctx.session.attendancePage || 1) - 1);
    await displayClassAttendancePage(ctx);
});

recordAttendanceByClassScene.action('page_next', async (ctx) => {
    await ctx.answerCbQuery();
    const total = ctx.session.attendanceStudents.length;
    const pageCount = Math.ceil(total / 10);
    ctx.session.attendancePage = Math.min(pageCount, (ctx.session.attendancePage || 1) + 1);
    await displayClassAttendancePage(ctx);
});


recordAttendanceByClassScene.action('submit_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const attendanceId = await generateUniqueAttendanceId();
        const students = ctx.session.attendanceStudents;

        const presentCount = students.filter(s => s.status === 'present').length;
        const absentCount = students.length - presentCount;

        const record = new Attendance({
            attendanceId,
            teacherId: teacher.teacherId,
            teacherName: teacher.name,
            subject: 'N/A', 
            className: ctx.session.attendanceClass,
            date: new Date(),
            students: students.map(s => ({
                studentId: s.studentId,
                studentName: s.studentName,
                status: s.status,
                parentNotified: false
            })),
            totalStudents: students.length,
            presentCount,
            absentCount
        });

        await record.save();

        for (const s of record.students) {
            if (s.status === 'absent' && !s.parentNotified) {
                try {
                    const studentDoc = await Student.findOne({ studentId: s.studentId });
                    if (studentDoc && studentDoc.parentId) {
                        await bot.telegram.sendMessage(
                            studentDoc.parentId,
                            `📢 Attendance Notification\n\n` +
                            `Your child <b>${studentDoc.name}</b> (${studentDoc.studentId}) was marked <b>ABSENT</b> today.\n\n` +
                            `🏫 Class: ${record.className}\n📅 Date: ${new Date(record.date).toLocaleDateString()}`,
                            { parse_mode: 'HTML' }
                        );

                        
                        s.parentNotified = true;
                    }
                } catch (err) {
                    console.error(`Failed to notify parent of ${s.studentId}:`, err);
                }
            }
        }
        await record.save();

        ctx.reply(
            `✅ Attendance saved for class ${ctx.session.attendanceClass}\n📊 Present: ${presentCount}, Absent: ${absentCount}`,
            teacherMenu
        );

    } catch (err) {
        console.error('Error saving attendance by class:', err);
        ctx.reply('🛑 Error saving attendance.', teacherMenu);
    }

    delete ctx.session.attendanceStudents;
    delete ctx.session.attendanceClass;
    delete ctx.session.attendanceMessageId;
    delete ctx.session.attendancePage;
    ctx.scene.leave();
});


recordAttendanceByClassScene.action('cancel_class_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Attendance cancelled.', teacherMenu);
    ctx.scene.leave();
});

stage.register(recordAttendanceByClassScene);


const helpScene = new Scenes.BaseScene('help_scene');

helpScene.enter(async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user) {
        await ctx.reply('🛑 Please log in to access help.');
        return ctx.scene.leave();
    }

    const schoolDetails = `
🏫 School Contact Information

Name: Sunshine Academy
Address: 123 Education Lane, Nairobi, Kenya
Phone: +254 700 123 456
Email: info@sunshineacademy.ac.ke
Website: www.sunshineacademy.ac.ke
Office Hours: Monday–Friday, 8:00 AM–4:00 PM EAT

Powered by Identity © 2025.
    `;

    await ctx.reply(
        schoolDetails,
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Back to Main', 'help_back_to_main')],
            ])
        }
    );

   
});

helpScene.action('help_back_to_main', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user) {
        await ctx.reply('🛑 Please log in to access the bot.');
        return ctx.scene.leave();
    }

    const menu = loginMenu;
    await ctx.reply('✅ Returned to main menu.', loginMenu);

    ctx.scene.leave();
});

stage.register(helpScene);



/// --- SHOW ADMIN DETAILS SCENE (MASTER ADMIN ONLY) ---
const adminDetailsScene = new Scenes.BaseScene('admin_details_scene');

adminDetailsScene.enter(async (ctx) => {
  try {
    const masterAdminId = process.env.MASTER_ADMIN_ID;

    
    

    const admins = await User.find({ role: 'admin', masterAdmin: { $ne: true } });

    if (!admins || admins.length === 0) {
      await ctx.reply('🛑 No admins available to view details.', masterAdminMenu);
      return ctx.scene.leave();
    }

    const buttons = admins.map(admin => [
      Markup.button.callback(
        `${admin.name || admin.username || 'Unknown'} (${admin.telegramId})`,
        `admin_details_${admin.telegramId}`
      )
    ]);
    buttons.push([Markup.button.callback('🛑 Cancel', 'admin_details_cancel')]);

    await ctx.reply(
      '🔍 Select an admin to view details:',
      Markup.inlineKeyboard(buttons)
    );

  } catch (error) {
    console.error('Error fetching admins:', error);
    await ctx.reply('🛑 Error fetching admins. Please try again.', masterAdminMenu);
    await notifyMasterAdmin(ctx, 'admin_details_error', {
      adminId: ctx.from.id,
      error: error.message,
      timestamp: new Date()
    });
    ctx.scene.leave();
  }
});

adminDetailsScene.action(/^admin_details_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const targetAdminId = ctx.match[1];

  try {
    const masterAdminId = process.env.MASTER_ADMIN_ID;

    const admin = await User.findOne({
  telegramId: String(targetAdminId),
  role: 'admin'
}) || await User.findOne({
  telegramId: Number(targetAdminId),
  role: 'admin'
});

    if (!admin) {
      await ctx.reply('🛑 Admin not found.', masterAdminMenu);
      return ctx.scene.leave();
    }

    let detailsMessage = `🔍 <b>Admin Details</b>\n\n`;
    detailsMessage += `👤 <b>Name:</b> ${admin.name || 'N/A'}\n`;
    detailsMessage += `💬 <b>Username:</b> ${admin.username || 'N/A'}\n`;
    detailsMessage += `🆔 <b>Telegram ID:</b> ${admin.telegramId}\n`;
    detailsMessage += `🏷️ <b>Role:</b> ${admin.role}\n`;
    detailsMessage += `👑 <b>Master Admin:</b> ${admin.masterAdmin ? 'Yes' : 'No'}\n`;
    detailsMessage += `🧾 <b>Admin ID:</b> ${admin.adminId || 'N/A'}\n`;
    detailsMessage += `🕓 <b>Created:</b> ${admin.createdAt ? new Date(admin.createdAt).toLocaleString() : 'N/A'}\n`;
    detailsMessage += `🕓 <b>Updated:</b> ${admin.updatedAt ? new Date(admin.updatedAt).toLocaleString() : 'N/A'}\n`;
    if (admin.lastActivity) {
      detailsMessage += `📅 <b>Last Activity:</b> ${new Date(admin.lastActivity).toLocaleString()}\n`;
    }

    await ctx.replyWithHTML(detailsMessage, masterAdminMenu);
    await logAdminAction(ctx, 'VIEW_ADMIN_DETAILS', {
      viewedAdmin: admin.name || 'Unknown',
      viewedId: admin.telegramId
    });

    ctx.scene.leave();
  } catch (error) {
    console.error('Error viewing admin details:', error);
    await ctx.reply('🛑 Error viewing admin details. Please try again.', masterAdminMenu);
    await notifyMasterAdmin(ctx, 'admin_details_error', {
      adminId: ctx.from.id,
      error: error.message,
      timestamp: new Date()
    });
    ctx.scene.leave();
  }
});

adminDetailsScene.action('admin_details_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✅ Admin details view cancelled.', masterAdminMenu);
  ctx.scene.leave();
});

stage.register(adminDetailsScene);

// --- CONTACT ADMIN SCENE (MASTER ADMIN ONLY) ---
const contactAdminScene = new Scenes.BaseScene('contact_admin_scene');

contactAdminScene.enter(async (ctx) => {
  try {
    const masterAdminId = process.env.MASTER_ADMIN_ID;

    if (String(ctx.from.id) !== String(masterAdminId)) {
      await ctx.reply('🛑 Unauthorized: Only the master admin can contact admins.');
      return ctx.scene.leave();
    }

    const admins = await User.find({ role: 'admin', masterAdmin: { $ne: true } });

    if (!admins || admins.length === 0) {
      await ctx.reply('🛑 No admins available to contact.', masterAdminMenu);
      return ctx.scene.leave();
    }

    const buttons = admins.map(admin => [
      Markup.button.callback(
        `${admin.name || admin.username || 'Unknown'} (${admin.telegramId})`,
        `select_admin_${admin.telegramId}`
      )
    ]);
    buttons.push([Markup.button.callback('🛑 Cancel', 'contact_admin_cancel')]);

    await ctx.reply('📩 Select an admin to contact:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error fetching admins:', error);
    await ctx.reply('🛑 Error fetching admins. Please try again.', masterAdminMenu);
    await notifyMasterAdmin(ctx, 'contact_admin_error', {
      adminId: ctx.from.id,
      error: error.message,
      timestamp: new Date()
    });
    ctx.scene.leave();
  }
});

contactAdminScene.action(/^select_admin_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const targetAdminId = ctx.match[1];

  try {
    const admin =
      await User.findOne({ telegramId: String(targetAdminId), role: 'admin' }) ||
      await User.findOne({ telegramId: Number(targetAdminId), role: 'admin' });

    if (!admin) {
      await ctx.reply('🛑 Admin not found.', masterAdminMenu);
      return ctx.scene.leave();
    }

    ctx.session.contactAdminId = targetAdminId;
    await ctx.reply('📤 Please send the message or media to forward to the admin.');
  } catch (error) {
    console.error('Error selecting admin:', error);
    await ctx.reply('🛑 Error selecting admin. Please try again.', masterAdminMenu);
   
    ctx.scene.leave();
  }
});

contactAdminScene.on('message', async (ctx) => {
  const targetAdminId = ctx.session.contactAdminId;
  if (!targetAdminId) {
    await ctx.reply('🛑 No admin selected. Please start over.', masterAdminMenu);
    return ctx.scene.leave();
  }

  try {
    const admin =
      await User.findOne({ telegramId: String(targetAdminId), role: 'admin' }) ||
      await User.findOne({ telegramId: Number(targetAdminId), role: 'admin' });

    if (!admin) {
      await ctx.reply('🛑 Admin not found.', masterAdminMenu);
      return ctx.scene.leave();
    }

    // --- Forward messages ---
    if (ctx.message.text) {
      await ctx.telegram.sendMessage(
        targetAdminId,
        `📩 Message from Master Admin (${ctx.from.id}): ${ctx.message.text}`
      );
    } else if (ctx.message.photo) {
      await ctx.telegram.sendPhoto(
        targetAdminId,
        ctx.message.photo[ctx.message.photo.length - 1].file_id,
        { caption: `📩 Photo from Master Admin (${ctx.from.id})` }
      );
    } else if (ctx.message.document) {
      await ctx.telegram.sendDocument(
        targetAdminId,
        ctx.message.document.file_id,
        { caption: `📩 Document from Master Admin (${ctx.from.id})` }
      );
    } else if (ctx.message.video) {
      await ctx.telegram.sendVideo(
        targetAdminId,
        ctx.message.video.file_id,
        { caption: `📩 Video from Master Admin (${ctx.from.id})` }
      );
    } else if (ctx.message.audio) {
      await ctx.telegram.sendAudio(
        targetAdminId,
        ctx.message.audio.file_id,
        { caption: `📩 Audio from Master Admin (${ctx.from.id})` }
      );
    } else {
      await ctx.reply('🛑 Unsupported media type. Please send text, photo, document, video, or audio.', masterAdminMenu);
      return ctx.scene.leave();
    }

    await ctx.reply('✅ Message sent to admin.', masterAdminMenu);
    

    delete ctx.session.contactAdminId;
    ctx.scene.leave();
  } catch (error) {
    console.error('Error sending message:', error);
    await ctx.reply('🛑 Error sending message. Please try again.', masterAdminMenu);
    await notifyMasterAdmin(ctx, 'contact_admin_error', {
      adminId: ctx.from.id,
      error: error.message,
      timestamp: new Date()
    });
    ctx.scene.leave();
  }
});

contactAdminScene.action('contact_admin_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('✅ Contact admin cancelled.', masterAdminMenu);
  delete ctx.session.contactAdminId;
  ctx.scene.leave();
});

stage.register(contactAdminScene);


// Teacher My Subjects Scene


const teacherMySubjectsScene = new Scenes.BaseScene('teacher_my_subjects_scene');

teacherMySubjectsScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher) {
            ctx.reply('🛑 Teacher profile not found.', teacherMenu);
            return ctx.scene.leave();
        }

        const currentSubjects = teacher.subjects || [];
        const pendingSubjects = teacher.pendingSubjects || [];

        let message = '📚 My Subjects\n\n';
        
        if (currentSubjects.length > 0) {
            message += '✅ Approved Subjects:\n';
            currentSubjects.forEach((subject, index) => {
                message += `${index + 1}. ${subject}\n`;
            });
            message += '\n';
        }

        if (pendingSubjects.length > 0) {
            message += '⏳ Pending Approval:\n';
            pendingSubjects.forEach((subject, index) => {
                message += `${index + 1}. ${subject}\n`;
            });
            message += '\n';
        }

        if (currentSubjects.length === 0 && pendingSubjects.length === 0) {
            message += '📝 You have no subjects yet. Add your first subject!\n\n';
        }

        const buttons = [
            [Markup.button.callback('➕ Add New Subject', 'add_new_subject')]
        ];

        if (currentSubjects.length > 0) {
            buttons.push(
                [Markup.button.callback('✏️ Edit Subject Name', 'edit_subject_name')],
                [Markup.button.callback('🗑️ Delete Subject', 'delete_subject')]
            );
        }

        buttons.push([Markup.button.callback('Close', 'close_subjects')]);

        ctx.replyWithHTML(message, Markup.inlineKeyboard(buttons));

    } catch (error) {
        console.error('Error in teacher my subjects scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

const addNewSubjectScene = new Scenes.BaseScene('add_new_subject_scene');

addNewSubjectScene.enter((ctx) => {
  ctx.reply(
    '📝 Add New Subject\n\n' +
    'Please enter the name of the subject you want to add:\n\n' +
    '📋 Examples: Mathematics, English Language, Physics, Chemistry\n' +
    '💡 Tip: Use clear and descriptive subject names',
    Markup.keyboard([['🛑 Cancel']]).resize()
  );
});

addNewSubjectScene.on('text', async (ctx) => {
  const subjectName = ctx.message.text.trim();

  if (subjectName === '🛑 Cancel') {
    await ctx.reply('🛑 Subject addition cancelled.', teacherMenu);
    return ctx.scene.leave();
  }

  if (!subjectName || subjectName.length < 1 || subjectName.length > 50) {
    await ctx.reply('🛑 Invalid subject name. Please enter a valid subject name (1–50 characters).');
    return;
  }

  try {
    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (!teacher) {
      await ctx.reply('🛑 Teacher profile not found.', teacherMenu);
      return ctx.scene.leave();
    }

    const allSubjects = [...(teacher.subjects || []), ...(teacher.pendingSubjects || [])];
    if (allSubjects.includes(subjectName)) {
      await ctx.reply('🛑 This subject is already in your list (either approved or pending).');
      return ctx.scene.leave();
    }

    teacher.pendingSubjects = teacher.pendingSubjects || [];
    teacher.pendingSubjects.push(subjectName);
    await teacher.save();

    const requestId = `${teacher.teacherId}_${encodeURIComponent(subjectName)}`;
    const sentMessages = [];
    const admins = await User.find({ role: 'admin' });

    for (const admin of admins) {
      try {
        const sentMsg = await ctx.telegram.sendMessage(
          admin.telegramId,
          `📋 <b>New Subject Request</b>\n\n` +
          `👤 Teacher: <b>${teacher.name}</b> (${teacher.teacherId})\n` +
          `📚 Subject: <b>${subjectName}</b>\n` +
          `📅 Requested: <b>${new Date().toLocaleString()}</b>\n\n` +
          `Please approve or deny this subject request:`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Approve', `approve_subject_${teacher.teacherId}_${encodeURIComponent(subjectName)}`),
                Markup.button.callback('🛑 Deny', `deny_subject_${teacher.teacherId}_${encodeURIComponent(subjectName)}`)
              ]
            ])
          }
        );
        sentMessages.push({ adminId: admin.telegramId, messageId: sentMsg.message_id });
      } catch (err) {
        console.error(`Failed to notify admin ${admin.telegramId}:`, err);
      }
    }

    if (sentMessages.length > 0) {
      const approvalDoc = new ApprovalMessage({
        type: 'subject',
        requestId,
        messages: sentMessages,
        createdAt: new Date()
      });
      await approvalDoc.save();
    }

    await ctx.replyWithHTML(
      `✅ <b>Subject Request Submitted!</b>\n\n` +
      `📚 Subject: <b>${subjectName}</b>\n` +
      `⏳ Status: Pending admin approval\n\n` +
      `You'll be notified once an admin reviews your request.`,
      teacherMenu
    );

    setTimeout(async () => {
      try {
        const approval = await ApprovalMessage.findOne({ type: 'subject', requestId });
        if (!approval) return; 

        const freshTeacher = await Teacher.findOne({ teacherId: teacher.teacherId });
        if (!freshTeacher) return;

        const stillPending = freshTeacher.pendingSubjects?.includes(subjectName);
        if (!stillPending) {
          await ApprovalMessage.deleteOne({ _id: approval._id });
          return;
        }

        freshTeacher.pendingSubjects = freshTeacher.pendingSubjects.filter(s => s !== subjectName);
        await freshTeacher.save();
        await ApprovalMessage.deleteOne({ _id: approval._id });

        const expiredText =
          `⌛ <b>Subject Request Expired</b>\n\n` +
          `👤 Teacher: <b>${freshTeacher.name}</b> (${freshTeacher.teacherId})\n` +
          `📚 Subject: <b>${subjectName}</b>\n` +
          `📅 Requested: <b>${approval.createdAt.toLocaleString()}</b>\n\n` +
          `⚠️ No admin action was taken within 1 hour.\n` +
          `The pending request has been automatically cleared.`;

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
          await ctx.telegram.sendMessage(master.telegramId, expiredText, { parse_mode: 'HTML' });
        }

        for (const admin of admins) {
          await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
        }

        await ctx.telegram.sendMessage(
          freshTeacher.telegramId,
          `⚠️ Your subject request "<b>${subjectName}</b>" has expired after 1 hour without admin review and has been cleared.`,
          { parse_mode: 'HTML' }
        );

      } catch (err) {
        console.error('Error auto-clearing expired subject request:', err);
      }
    }, 3 * 60 * 1000);

  } catch (err) {
    console.error('Error adding new subject:', err);
    await ctx.reply('🛑 An error occurred while adding the subject.', teacherMenu);
  }

  ctx.scene.leave();
});


// Edit Subject Name Scene
const editSubjectNameScene = new Scenes.BaseScene('edit_subject_name_scene');

editSubjectNameScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no approved subjects to edit.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `edit_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_edit_subject')]);

        ctx.reply(
            '✏️ Edit Subject Name\n\n' +
            'Select the subject you want to rename:',
            Markup.inlineKeyboard(subjectButtons)
        );

    } catch (error) {
        console.error('Error in edit subject scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

editSubjectNameScene.action(/^edit_subject_(.+)$/, async (ctx) => {
    const oldSubjectName = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    ctx.session.editingSubject = oldSubjectName;
    
    ctx.reply(
        `✏️ Editing: ${oldSubjectName}\n\n` +
        'Please enter the new name for this subject:',
        Markup.keyboard([['🛑 Cancel']]).resize()
    );
});

editSubjectNameScene.on('text', async (ctx) => {
    const newSubjectName = ctx.message.text.trim();
    const oldSubjectName = ctx.session.editingSubject;
    
    if (newSubjectName === '🛑 Cancel') {
        ctx.reply('🛑 Subject editing cancelled.', teacherMenu);
        delete ctx.session.editingSubject;
        return ctx.scene.leave();
    }

    if (!isValidSubject(newSubjectName)) {
        ctx.reply('🛑 Invalid subject name. Please enter a valid subject name (1-50 characters).');
        return;
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (teacher.subjects.includes(newSubjectName) || teacher.pendingSubjects.includes(newSubjectName)) {
            ctx.reply('🛑 This subject name is already in use.');
            return;
        }

        const subjectIndex = teacher.subjects.indexOf(oldSubjectName);
        if (subjectIndex !== -1) {
            teacher.subjects[subjectIndex] = newSubjectName;
            await teacher.save();

            await TeacherStudent.updateMany(
                { teacherId: teacher.teacherId, subject: oldSubjectName },
                { $set: { subject: newSubjectName } }
            );

            await Grade.updateMany(
                { teacherId: teacher.teacherId, subject: oldSubjectName },
                { $set: { subject: newSubjectName } }
            );

            await Attendance.updateMany(
                { teacherId: teacher.teacherId, subject: oldSubjectName },
                { $set: { subject: newSubjectName } }
            );

            ctx.replyWithHTML(
                `✅ Subject Renamed Successfully!\n\n` +
                `📛 Old Name: ${oldSubjectName}\n` +
                `📛 New Name: ${newSubjectName}\n\n` +
                `All student relationships, grades, and attendance records have been updated.`,
                teacherMenu
            );

           
        }

    } catch (error) {
        console.error('Error editing subject:', error);
        ctx.reply('🛑 An error occurred while editing the subject.', teacherMenu);
    }
    
    delete ctx.session.editingSubject;
    ctx.scene.leave();
});

editSubjectNameScene.action('cancel_edit_subject', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Subject editing cancelled.', teacherMenu);
    ctx.scene.leave();
});



// Delete Subject Scene
const deleteSubjectScene = new Scenes.BaseScene('delete_subject_scene');

deleteSubjectScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no approved subjects to delete.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `delete_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_delete_subject')]);

        ctx.reply(
            '🗑️ Delete Subject\n\n' +
            'Select the subject you want to delete:\n\n' +
            '⚠️ Warning: This will also remove all students, grades, and attendance records for this subject!',
            Markup.inlineKeyboard(subjectButtons)
        );

    } catch (error) {
        console.error('Error in delete subject scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

deleteSubjectScene.action(/^delete_subject_(.+)$/, async (ctx) => {
    const subjectName = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        // Get statistics for confirmation
        const studentCount = await TeacherStudent.countDocuments({
            teacherId: teacher.teacherId,
            subject: subjectName
        });
        
        const gradeCount = await Grade.countDocuments({
            teacherId: teacher.teacherId,
            subject: subjectName
        });
        
        const attendanceCount = await Attendance.countDocuments({
            teacherId: teacher.teacherId,
            subject: subjectName
        });

        ctx.session.subjectToDelete = subjectName;
        ctx.session.deleteStats = { studentCount, gradeCount, attendanceCount };

        ctx.replyWithHTML(
            `⚠️ CONFIRM SUBJECT DELETION\n\n` +
            `📚 Subject: ${subjectName}\n\n` +
            `📊 This will permanently delete:\n` +
            `• ${studentCount} student relationships\n` +
            `• ${gradeCount} grade records\n` +
            `• ${attendanceCount} attendance records\n\n` +
            `🛑 This action cannot be undone!\n\n` +
            `Are you sure you want to proceed?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Delete Everything', 'confirm_subject_deletion')],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_delete_subject')]
            ])
        );

    } catch (error) {
        console.error('Error preparing subject deletion:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

deleteSubjectScene.action('confirm_subject_deletion', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const subjectName = ctx.session.subjectToDelete;
        const { studentCount, gradeCount, attendanceCount } = ctx.session.deleteStats;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        teacher.subjects = teacher.subjects.filter(subj => subj !== subjectName);
        await teacher.save();

        await TeacherStudent.deleteMany({
            teacherId: teacher.teacherId,
            subject: subjectName
        });

        await Grade.deleteMany({
            teacherId: teacher.teacherId,
            subject: subjectName
        });

        await Attendance.deleteMany({
            teacherId: teacher.teacherId,
            subject: subjectName
        });

        ctx.replyWithHTML(
            `✅ Subject Deleted Successfully!\n\n` +
            `📚 Subject: ${subjectName}\n\n` +
            `🗑️ Removed:\n` +
            `• ${studentCount} student relationships\n` +
            `• ${gradeCount} grade records\n` +
            `• ${attendanceCount} attendance records\n\n` +
            `All data for this subject has been permanently deleted.`,
            teacherMenu
        );

        

    } catch (error) {
        console.error('Error deleting subject:', error);
        ctx.reply('🛑 An error occurred while deleting the subject.', teacherMenu);
    }
    
    delete ctx.session.subjectToDelete;
    delete ctx.session.deleteStats;
    ctx.scene.leave();
});

deleteSubjectScene.action('cancel_delete_subject', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Subject deletion cancelled.', teacherMenu);
    delete ctx.session.subjectToDelete;
    delete ctx.session.deleteStats;
    ctx.scene.leave();
});


bot.action(/^tutor_accept_(.+)_(.+)_(.+)$/, async (ctx) => {
  const parentId = ctx.match[1];
  const teacherId = ctx.match[2];
  const subject = ctx.match[3];

  await ctx.answerCbQuery('✅ Accepted');

  const teacher = await Teacher.findOne({ teacherId });
  const parentUser = await User.findOne({ telegramId: parentId });
  const parentUsername = parentUser?.username ? '@' + parentUser.username : parentUser?.name;

  try {
    await ctx.telegram.sendMessage(
      parentId,
      `✅ Your tutoring request for subject <b>${subject}</b> has been <b>accepted</b>!`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Failed to notify parent of acceptance:', err);
  }

  await ctx.editMessageText('✅ You accepted the tutoring request.', { parse_mode: 'HTML' });


  const offer = await FreelanceOffer.findOne({ teacherId, subject });

let offerDetails = '';
if (offer) {
  offerDetails =
    `\n💰 <b>Rate:</b> ${offer.salaryPerHour}/hour` +
    `\n⏱ <b>Hours/Day:</b> ${offer.hoursPerDay}` +
    `\n📅 <b>Days/Week:</b> ${offer.daysPerWeek}`;
}
  await ctx.telegram.sendMessage(
    process.env.NOTIFY_ME,
    `📢 <b>Tutoring Request Accepted</b>\n\n` +
    `👩‍🏫 <b>Teacher:</b> ${teacher?.name || 'Unknown'} (ID: ${teacherId})\n` +
    `💬 Teacher Username: @${teacher?.username || 'N/A'}\n` +
    `📞 Teacher Phone: ${teacher?.phoneNumber || 'N/A'}\n\n` +
    `🆔 Teacher Telegram ID: ${teacher?.telegramId || 'N/A'}\n\n` +
    `👤 <b>Parent:</b> ${parentUser?.name || 'Unknown'} (${parentUsername || 'N/A'})\n` +
    `🆔 Parent Telegram ID: ${parentId}\n\n` +
    `📚 <b>Subject:</b> ${subject}\n` +
     offerDetails + `\n\n` +
    `📅 Time: ${new Date().toLocaleString()}`,
    { parse_mode: 'HTML' }
  );
});

bot.action(/^tutor_ignore_(.+)_(.+)_(.+)$/, async (ctx) => {
  const parentId = ctx.match[1];
  const teacherId = ctx.match[2];
  const subject = ctx.match[3];

  await ctx.answerCbQuery('🛑 Ignored');

  const teacher = await Teacher.findOne({ teacherId });
  const parentUser = await User.findOne({ telegramId: parentId });
  const parentUsername = parentUser?.username ? '@' + parentUser.username : parentUser?.name;

  try {
    await ctx.telegram.sendMessage(
      parentId,
      `🛑 Your tutoring request for subject <b>${subject}</b> was ignored.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Failed to notify parent of ignore:', err);
  }

  await ctx.editMessageText('🛑 You ignored the tutoring request.', { parse_mode: 'HTML' });

  await ctx.telegram.sendMessage(
    process.env.NOTIFY_ME,
    `📢 <b>Tutoring Request Ignored</b>\n\n` +
    `👩‍🏫 <b>Teacher:</b> ${teacher?.name || 'Unknown'} (ID: ${teacherId})\n` +
    `🆔 Teacher Telegram ID: ${teacher?.telegramId || 'N/A'}\n\n` +
    `👤 <b>Parent:</b> ${parentUser?.name || 'Unknown'} (${parentUsername || 'N/A'})\n` +
    `🆔 Parent Telegram ID: ${parentId}\n\n` +
    `📚 <b>Subject:</b> ${subject}\n` +
    `📅 Time: ${new Date().toLocaleString()}`,
    { parse_mode: 'HTML' }
  );
});


bot.action(/^tutor_ignore_(.+)_(.+)_(.+)$/, async (ctx) => {
  const parentId = ctx.match[1];
  const teacherId = ctx.match[2];
  const subject = ctx.match[3];

  await ctx.answerCbQuery('🛑 Ignored');

  try {
    await ctx.telegram.sendMessage(
      parentId,
      `🛑 Your tutoring request for subject <b>${subject}</b> was ignored.`,
      { parse_mode: 'HTML' }
    );
  } catch (err) {
    console.error('Failed to notify parent of ignore:', err);
  }

  await ctx.editMessageText('🛑 You ignored the tutoring request.', { parse_mode: 'HTML' });
});

bot.action(/^approve_subject_(TE\d+)_(.+)$/, async (ctx) => {
    const teacherId = ctx.match[1];
    const subject = decodeURIComponent(ctx.match[2]);
    const requestId = `${teacherId}_${subject}`;

    await ctx.answerCbQuery('Approving subject...');

    try {
        const teacher = await getTeacherById(teacherId);
        if (!teacher || !teacher.pendingSubjects || !teacher.pendingSubjects.includes(subject)) {
            await ctx.reply('🛑 Request not found or already processed.');
            return;
        }

        const approver = await User.findOne({ telegramId: ctx.from.id });
        const approverName = approver ? (approver.name || ctx.from.first_name || ctx.from.username || 'An Admin') : 'An Admin';

        teacher.subjects.push(subject);
        teacher.pendingSubjects = teacher.pendingSubjects.filter(s => s !== subject);
        await teacher.save();

        

        const approval = await ApprovalMessage.findOne({ type: 'subject', requestId });
        if (approval) {
            for (const msg of approval.messages) {
                try {
                    await ctx.telegram.editMessageText(
                        msg.adminId,
                        msg.messageId,
                        null,
                        `✅ Subject <b>${subject}</b> approved for <b>${teacher.name}</b>\n` +
                        `👤 Approved by: <b>${approverName}</b>\n` +
                        `⏰ ${new Date().toLocaleString()}`,
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
                    );
                } catch (err) {
                    console.error(`Failed to update message ${msg.messageId} in chat ${msg.adminId}:`, err);
                }
            }
            await clearApprovalMessages("subject_approval", `${teacherId}_${subject}`, true);

        }
        await logAdminAction(ctx, "APPROVE_SUBJECT", {
            teacherId: teacher.teacherId,
            teacherName: teacher.name,
            subject,
            approvedBy: approverName,
            approverId: ctx.from.id,
            approvedAt: new Date()
        });

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
            await ctx.telegram.sendMessage(
                master.telegramId,
                `📚 <b>Subject Approval Notice</b>\n\n` +
                `👤 Teacher: <b>${teacher.name}</b> (ID: ${teacher.teacherId})\n` +
                `📚 Subject: <b>${subject}</b>\n` +
                `✅ Approved by: <b>${approverName}</b>\n` +
                `🕒 ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        }
        await ctx.telegram.sendMessage(
            teacher.telegramId,
            `✅ Your request to add subject "<b>${subject}</b>" has been approved by <b>${approverName}</b>!`,
            { parse_mode: 'HTML' }
        );

        await ctx.replyWithHTML(`✅ You approved subject <b>${subject}</b> for <b>${teacher.name}</b>.`);
    } catch (error) {
        console.error('Error approving subject:', error);
        await ctx.reply('🛑 An error occurred while approving the subject.');
    }
});

bot.action(/^deny_subject_(TE\d+)_(.+)$/, async (ctx) => {
    const teacherId = ctx.match[1];
    const subject = decodeURIComponent(ctx.match[2]);
    const requestId = `${teacherId}_${subject}`;

    await ctx.answerCbQuery('Denying subject...');

    try {
        const teacher = await getTeacherById(teacherId);
        if (!teacher || !teacher.pendingSubjects || !teacher.pendingSubjects.includes(subject)) {
            await ctx.reply('🛑 Request not found or already processed.');
            return;
        }
        const denier = await User.findOne({ telegramId: ctx.from.id });
        const denierName = denier ? (denier.name || ctx.from.first_name || ctx.from.username || 'An Admin') : 'An Admin';

        const approval = await ApprovalMessage.findOne({ type: 'subject', requestId });
        if (approval) {
            for (const msg of approval.messages) {
                try {
                    await ctx.telegram.editMessageText(
                        msg.adminId,
                        msg.messageId,
                        null,
                        `INFO: Subject <b>${subject}</b> DENIED for <b>${teacher.name}</b>\n` +
                        `👤 Denied by: <b>${denierName}</b>\n` +
                        `⏰ ${new Date().toLocaleString()}`,
                        { parse_mode: 'HTML', reply_markup: { inline_keyboard: [] } }
                    );
                } catch (err) {
                    console.error(`Failed to update message ${msg.messageId} in chat ${msg.adminId}:`, err);
                }
            }
            await clearApprovalMessages("subject_approval", `${teacherId}_${subject}`, true);

        }
        await logAdminAction(ctx, "DENY_SUBJECT", {
            teacherId: teacher.teacherId,
            teacherName: teacher.name,
            subject,
            deniedBy: denierName,
            denierID: ctx.from.id,
            DeniedAt: new Date()
        });

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
            await ctx.telegram.sendMessage(
                master.telegramId,
                `📚 <b>Subject Denial Notice</b>\n\n` +
                `👤 Teacher: <b>${teacher.name}</b> (ID: ${teacher.teacherId})\n` +
                `📚 Subject: <b>${subject}</b>\n` +
                `✅ Denied by: <b>${denierName}</b>\n` +
                `🕒 ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        }
        await ctx.telegram.sendMessage(
            teacher.telegramId,
            ` INFO: Your request to add subject "<b>${subject}</b>" has been denied by <b>${denierName}</b>!`,
            { parse_mode: 'HTML' }
        );

        await ctx.replyWithHTML(`INFO: You denied subject <b>${subject}</b> for <b>${teacher.name}</b>.`);
   
    } catch (error) {
        console.error('Error denying subject:', error);
        await ctx.reply('🛑 An error occurred while denying the subject.');
    }
});



teacherMySubjectsScene.action('close_subjects', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('✅ Subjects menu closed.', teacherMenu);
    ctx.scene.leave();
});

teacherMySubjectsScene.action('add_new_subject', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('add_new_subject_scene');
});

teacherMySubjectsScene.action('edit_subject_name', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('edit_subject_name_scene');
});

teacherMySubjectsScene.action('delete_subject', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('delete_subject_scene');
});

stage.register(teacherMySubjectsScene);
stage.register(addNewSubjectScene);
stage.register(editSubjectNameScene);
stage.register(deleteSubjectScene);

const teacherMyStudentsScene = new Scenes.BaseScene('teacher_my_students_scene');

teacherMyStudentsScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher) {
            ctx.reply('🛑 Teacher profile not found.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.reply(
            '👥 My Students\n\nHow would you like to view your students?',
            Markup.inlineKeyboard([
                [Markup.button.callback('📚 By Subject', 'view_by_subject')],
                [Markup.button.callback('🏫 By Class', 'view_by_class')],
                [Markup.button.callback('🛑 Cancel', 'cancel_my_students')]
            ])
        );

    } catch (error) {
        console.error('Error in teacher my students scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherMyStudentsScene.action('view_by_subject', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher || !teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no subjects assigned.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `subject_students_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('⬅️ Back', 'back_to_my_students')]);

        ctx.reply('📚 Select a subject to view students:', Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        console.error('Error selecting view by subject:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherMyStudentsScene.action('view_by_class', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const classes = await TeacherStudent.distinct('className', {
            teacherId: teacher.teacherId
        });

        if (classes.length === 0) {
            ctx.reply('🛑 You have no students in any classes.', teacherMenu);
            return ctx.scene.leave();
        }

        const classButtons = classes.map(className => 
            [Markup.button.callback(className, `class_students_${className.replace(/ /g, '_')}`)]
        );
        
        classButtons.push([Markup.button.callback('⬅️ Back', 'back_to_my_students')]);

        ctx.reply('🏫 Select a class to view students:', Markup.inlineKeyboard(classButtons));

    } catch (error) {
        console.error('Error selecting view by class:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherMyStudentsScene.action(/^subject_students_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found for ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.studentListView = {
            type: 'subject',
            identifier: subject,
            students: students,
            currentPage: 0,
            totalPages: Math.ceil(students.length / 10)
        };

        await displayStudentList(ctx);

    } catch (error) {
        console.error('Error loading subject students:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherMyStudentsScene.action(/^class_students_(.+)$/, async (ctx) => {
    const className = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            className: className
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found in ${className}.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.studentListView = {
            type: 'class',
            identifier: className,
            students: students,
            currentPage: 0,
            totalPages: Math.ceil(students.length / 10)
        };

        await displayStudentList(ctx);

    } catch (error) {
        console.error('Error loading class students:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

const displayStudentList = async (ctx) => {
    const { studentListView } = ctx.session;
    const { type, identifier, students, currentPage, totalPages } = studentListView;
    
    const startIndex = currentPage * 10;
    const endIndex = Math.min(startIndex + 10, students.length);
    const currentStudents = students.slice(startIndex, endIndex);
    
    let message = `👥 Students ${type === 'subject' ? 'in' : 'from'} ${identifier}\n\n`;
    message += `📊 Total: ${students.length} students\n`;
    message += `📄 Page ${currentPage + 1} of ${totalPages}\n\n`;
    
    currentStudents.forEach((student, index) => {
        const globalIndex = startIndex + index + 1;
        message += `${globalIndex}. ${student.studentName}\n`;
        message += `   🆔 ID: <code>${student.studentId}</code>\n`;
        if (type === 'class') {
            message += `   📚 Subject: ${student.subject}\n`;
        } else {
            message += `   🏫 Class: ${student.className}\n`;
        }
        message += '\n';
    });
    
    const paginationButtons = [];
    
    if (currentPage > 0) {
        paginationButtons.push(Markup.button.callback('⬅️ Previous', 'students_prev_page'));
    }
    
    if (currentPage < totalPages - 1) {
        paginationButtons.push(Markup.button.callback('Next ➡️', 'students_next_page'));
    }
    
    const actionButtons = [
        [Markup.button.callback('🗑️ Remove This List', 'remove_student_list')],
        [Markup.button.callback('⬅️ Back to View Options', 'back_to_view_options')],
        [Markup.button.callback('close', 'close_student_list')]
    ];
    
    const allButtons = [];
    if (paginationButtons.length > 0) {
        allButtons.push(paginationButtons);
    }
    allButtons.push(...actionButtons);
    
    if (ctx.session.studentListMessageId) {
        try {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                ctx.session.studentListMessageId,
                null,
                message,
                {
                    parse_mode: 'HTML',
                    reply_markup: Markup.inlineKeyboard(allButtons).reply_markup
                }
            );
        } catch (error) {
            const newMessage = await ctx.replyWithHTML(
                message,
                Markup.inlineKeyboard(allButtons)
            );
            ctx.session.studentListMessageId = newMessage.message_id;
        }
    } else {
        const newMessage = await ctx.replyWithHTML(
            message,
            Markup.inlineKeyboard(allButtons)
        );
        ctx.session.studentListMessageId = newMessage.message_id;
    }
};

teacherMyStudentsScene.action('students_prev_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.studentListView.currentPage--;
    await displayStudentList(ctx);
});

teacherMyStudentsScene.action('students_next_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.studentListView.currentPage++;
    await displayStudentList(ctx);
});

teacherMyStudentsScene.action('remove_student_list', async (ctx) => {
    await ctx.answerCbQuery();
    
    const { studentListView } = ctx.session;
    const { type, identifier } = studentListView;
    
    ctx.reply(
        `⚠️ CONFIRM DELETION\n\n` +
        `Are you sure you want to remove ALL students ${type === 'subject' ? 'from' : 'in'} ${identifier}?\n\n` +
        `This action cannot be undone!`,
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yes, Remove All', 'confirm_remove_list')],
            [Markup.button.callback('🛑 No, Cancel', 'cancel_remove_list')]
        ])
    );
});

teacherMyStudentsScene.action('confirm_remove_list', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const { studentListView } = ctx.session;
        const { type, identifier, students } = studentListView;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        let deleteCriteria;
        if (type === 'subject') {
            deleteCriteria = {
                teacherId: teacher.teacherId,
                subject: identifier
            };
        } else {
            deleteCriteria = {
                teacherId: teacher.teacherId,
                className: identifier
            };
        }
        
        const result = await TeacherStudent.deleteMany(deleteCriteria);
        
        if (ctx.session.studentListMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.studentListMessageId);
            } catch (error) {
                console.error('Error deleting message:', error);
            }
        }
        
        ctx.reply(
            `✅ Successfully removed ${result.deletedCount} students ${type === 'subject' ? 'from' : 'in'} ${identifier}.`,
            teacherMenu
        );
        
        delete ctx.session.studentListView;
        delete ctx.session.studentListMessageId;
        
    } catch (error) {
        console.error('Error removing student list:', error);
        ctx.reply('🛑 An error occurred while removing the list.', teacherMenu);
    }
    
    ctx.scene.leave();
});

teacherMyStudentsScene.action('cancel_remove_list', async (ctx) => {
    await ctx.answerCbQuery();
    await displayStudentList(ctx);
});

teacherMyStudentsScene.action('back_to_view_options', async (ctx) => {
    await ctx.answerCbQuery();
    
    delete ctx.session.studentListView;
    if (ctx.session.studentListMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.studentListMessageId);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
        delete ctx.session.studentListMessageId;
    }
    
    ctx.scene.reenter();
});

teacherMyStudentsScene.action('back_to_my_students', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.reenter();
});

teacherMyStudentsScene.action('close_student_list', async (ctx) => {
    await ctx.answerCbQuery();
    
    delete ctx.session.studentListView;
    if (ctx.session.studentListMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.studentListMessageId);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
        delete ctx.session.studentListMessageId;
    }
    
    ctx.reply('✅ Student list closed.', teacherMenu);
    ctx.scene.leave();
});

teacherMyStudentsScene.action('cancel_my_students', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 My students view cancelled.', teacherMenu);
    ctx.scene.leave();
});

stage.register(teacherMyStudentsScene);



const logger = {
    error: (message, meta = {}) => {
        console.log(JSON.stringify({
            level: 'error',
            timestamp: new Date().toISOString(),
            message,
            ...meta
        }));
    }
};

const RECORDS_PER_PAGE = parseInt(process.env.RECORDS_PER_PAGE) || 10;
const DAYS_LIMIT = parseInt(process.env.DAYS_LIMIT) || 30;
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS) || 5 * 60 * 1000; // 5 minutes

const teacherAttendanceScene = new Scenes.BaseScene('teacher_attendance_scene');



teacherAttendanceScene.enter(async (ctx) => {
    try {
        if (!ctx.from?.id || typeof ctx.from.id !== 'number') {
            logger.error('Invalid telegramId', { chatId: ctx.chat?.id, telegramId: ctx.from?.id });
            ctx.reply('🛑 Invalid user ID. Please try again.', teacherMenu);
            return ctx.scene.leave();
        }

        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher || !teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no subjects assigned.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `attendance_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🏫 By Class(Homeroom Only!)', 'record_by_class')]);
        subjectButtons.push([Markup.button.callback('📊 View Attendance Records', 'view_attendance_records')]);
        subjectButtons.push([Markup.button.callback('🔔 Attendance Reminders', 'attendance_reminders')]);
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_attendance')]);

        ctx.reply('📚 Select a subject to take attendance:', Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        logger.error('Error in teacher attendance scene', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherAttendanceScene.action(/^attendance_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found for ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.attendanceData = {
            subject: subject,
            className: students[0].className, // Assuming all students in same class
            students: students.map(student => ({
                studentId: student.studentId,
                studentName: student.studentName,
                status: 'present', // Default all present
                parentNotified: false
            })),
            date: new Date()
        };

        await displayAttendanceInterface(ctx);

    } catch (error) {
        logger.error('Error selecting subject for attendance', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

const displayAttendanceInterface = async (ctx, page = 1) => {
    const { attendanceData } = ctx.session;
    const { students, subject, className, date } = attendanceData;

    const pageSize = 10;
    const totalPages = Math.ceil(students.length / pageSize);
    const currentPage = Math.max(1, Math.min(page, totalPages));

    ctx.session.attendanceData.page = currentPage;

    const startIdx = (currentPage - 1) * pageSize;
    const pageStudents = students.slice(startIdx, startIdx + pageSize);

    let message = `📋 Attendance for ${subject}\n\n`;
    message += `🏫 Class: ${className}\n`;
    message += `📅 Date: ${date.toLocaleDateString()}\n\n`;
    message += `👥 Students: ${students.length}\n`;
    message += `✅ Present: ${students.filter(s => s.status === 'present').length}\n`;
    message += `🛑 Absent: ${students.filter(s => s.status === 'absent').length}\n\n`;
    message += `👤 Showing students ${startIdx + 1}-${Math.min(startIdx + pageSize, students.length)} of ${students.length}\n\n`;
    message += `Click a student to toggle attendance:\n`;

const studentButtons = pageStudents.map(student => {
    const emoji = student.status === 'present' ? '✅' : '🛑';
    return [Markup.button.callback(
        `${emoji} ${student.studentName}`,
        `toggle_attendance_${student.studentId}`
    )];
});

    const navButtons = [];
    if (currentPage > 1) navButtons.push(Markup.button.callback('⬅ Prev', `attendance_page_${currentPage - 1}`));
    if (currentPage < totalPages) navButtons.push(Markup.button.callback('➡ Next', `attendance_page_${currentPage + 1}`));
    if (navButtons.length > 0) studentButtons.push(navButtons);

    studentButtons.push(
        [Markup.button.callback('📤 Submit Attendance', 'submit_attendance')],
        [Markup.button.callback('🔄 Reset All', 'reset_attendance')],
        [Markup.button.callback('🛑 Cancel', 'cancel_attendance')]
    );

    if (ctx.session.attendanceMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.attendanceMessageId);
        } catch (error) {
            logger.error('Failed to delete old attendance message', { chatId: ctx.chat.id, messageId: ctx.session.attendanceMessageId, error: error.message });
        }
    }

    const newMessage = await ctx.replyWithHTML(
        message,
        Markup.inlineKeyboard(studentButtons)
    );
    ctx.session.attendanceMessageId = newMessage.message_id;
};


teacherAttendanceScene.action(/^attendance_page_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const page = parseInt(ctx.match[1]);
    if (isNaN(page) || page < 1) return;
    await displayAttendanceInterface(ctx, page);
});


teacherAttendanceScene.action(/^toggle_attendance_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const { attendanceData } = ctx.session;
        const studentIndex = attendanceData.students.findIndex(s => s.studentId === studentId);
        
        if (studentIndex !== -1) {
            attendanceData.students[studentIndex].status = 
                attendanceData.students[studentIndex].status === 'present' ? 'absent' : 'present';
            
            ctx.session.attendanceData = attendanceData;
            
            await displayAttendanceInterface(ctx);
           
        }
    } catch (error) {
        logger.error('Error toggling attendance', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
    }
});

teacherAttendanceScene.action('submit_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const { attendanceData } = ctx.session;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const attendanceId = await generateUniqueAttendanceId();
        
        const presentCount = attendanceData.students.filter(s => s.status === 'present').length;
        const absentCount = attendanceData.students.filter(s => s.status === 'absent').length;
        
        const attendanceDate = attendanceData.date instanceof Date ? attendanceData.date : new Date(attendanceData.date);
        
        const attendanceRecord = new Attendance({
            attendanceId: attendanceId,
            teacherId: teacher.teacherId,
            teacherName: teacher.name,
            subject: attendanceData.subject,
            className: attendanceData.className,
            date: attendanceDate,
            students: attendanceData.students,
            totalStudents: attendanceData.students.length,
            presentCount: presentCount,
            absentCount: absentCount
        });
        
        await attendanceRecord.save();
        
        const absentStudents = attendanceData.students.filter(s => s.status === 'absent');
        let notifiedCount = 0;
        
        for (const student of absentStudents) {
            const studentRecord = await Student.findOne({ studentId: student.studentId });
            
            if (studentRecord && studentRecord.parentId) {
                try {
                    await ctx.telegram.sendMessage(
                        studentRecord.parentId,
                        `📢 Attendance Notification\n\n` +
                        `Your child ${student.studentName} was marked absent from:\n` +
                        `📚 Subject: ${attendanceData.subject}\n` +
                        `🏫 Class: ${attendanceData.className}\n` +
                        `📅 Date: ${attendanceDate.toLocaleDateString()}\n\n` +
                        `If this is an error, please contact the school.`,
                        { parse_mode: "HTML" }
                    );
                    
                    notifiedCount++;
                    await Attendance.updateOne(
                        { attendanceId: attendanceId, "students.studentId": student.studentId },
                        { $set: { "students.$.parentNotified": true } }
                    );
                } catch (error) {
                }
            }
        }
        
        if (ctx.session.attendanceMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.attendanceMessageId);
            } catch (error) {
                console.log(error);
            }
        }

        ctx.replyWithHTML(
            `✅ Attendance Recorded Successfully!\n\n` +
            `📚 Subject: ${attendanceData.subject}\n` +
            `🏫 Class: ${attendanceData.className}\n` +
            `📅 Date: ${attendanceDate.toLocaleDateString()}\n\n` +
            `📊 Summary:\n` +
            `• Total Students: ${attendanceData.students.length}\n` +
            `• Present: ${presentCount}\n` +
            `• Absent: ${absentCount}\n` +
            `• Parents Notified: ${notifiedCount}\n\n` +
            `Attendance ID: ${attendanceId}`,
            teacherMenu
        );
        
        delete ctx.session.attendanceData;
        delete ctx.session.attendanceMessageId;
        if (ctx.session.attendanceTimeout) {
            clearTimeout(ctx.session.attendanceTimeout);
        }
        
    } catch (error) {
        ctx.reply('🛑 An error occurred while recording attendance.', teacherMenu);
    }
    
    ctx.scene.leave();
});
teacherAttendanceScene.action('reset_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const { attendanceData } = ctx.session;
        
        attendanceData.students.forEach(student => {
            student.status = 'present';
            student.parentNotified = false;
        });
        
        ctx.session.attendanceData = attendanceData;
        
        await displayAttendanceInterface(ctx);
       
        
    } catch (error) {
        logger.error('Error resetting attendance', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
    }
});

teacherAttendanceScene.action('cancel_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (ctx.session.attendanceMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.attendanceMessageId);
        } catch (error) {
            logger.error('Failed to delete attendance message on cancel', { chatId: ctx.chat.id, messageId: ctx.session.attendanceMessageId, error: error.message });
        }
    }

    ctx.reply('🛑 Attendance recording cancelled.', teacherMenu);
    delete ctx.session.attendanceData;
    delete ctx.session.attendanceMessageId;
    clearTimeout(ctx.session.attendanceTimeout);
    ctx.scene.leave();
});

teacherAttendanceScene.action('view_attendance_records', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('view_attendance_records_scene');
});

teacherAttendanceScene.action('attendance_reminders', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('teacher_reminder_scene');
});

const viewAttendanceRecordsScene = new Scenes.BaseScene('view_attendance_records_scene');

const setRecordsSessionTimeout = (ctx) => {
    if (ctx.session.recordsTimeout) {
        clearTimeout(ctx.session.recordsTimeout);
    }
    ctx.session.recordsTimeout = setTimeout(() => {
        delete ctx.session.recordsMessageId;
        delete ctx.session.recordsPage;
        logger.error('Records session timeout cleared', { chatId: ctx.chat?.id });
    }, SESSION_TIMEOUT_MS);
};

viewAttendanceRecordsScene.enter(async (ctx) => {
    if (!ctx.from?.id || typeof ctx.from.id !== 'number') {
        logger.error('Invalid telegramId', { chatId: ctx.chat?.id, telegramId: ctx.from?.id });
        ctx.reply('🛑 Invalid user ID. Please try again.', teacherMenu);
        return ctx.scene.leave();
    }

    setRecordsSessionTimeout(ctx);
    await displayAttendanceRecords(ctx, 1);
});

const displayAttendanceRecords = async (ctx, page = 1) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            logger.error('Teacher not found', { telegramId: ctx.from.id });
            ctx.reply('🛑 Teacher not found. Please register first.', teacherMenu);
            return ctx.scene.leave();
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DAYS_LIMIT);

        const totalRecords = await Attendance.countDocuments({
            teacherId: teacher.teacherId,
            date: { $gte: thirtyDaysAgo }
        });

        const records = await Attendance.find({
            teacherId: teacher.teacherId,
            date: { $gte: thirtyDaysAgo }
        })
            .sort({ date: -1 })
            .skip((page - 1) * RECORDS_PER_PAGE)
            .limit(RECORDS_PER_PAGE);

        if (records.length === 0) {
            if (ctx.session.recordsMessageId) {
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.recordsMessageId);
                } catch (error) {
                    logger.error('Failed to delete old records message', { chatId: ctx.chat.id, messageId: ctx.session.recordsMessageId, error: error.message });
                }
                delete ctx.session.recordsMessageId;
            }
            ctx.reply(`📊 No attendance records found for the last ${DAYS_LIMIT} days.`, teacherMenu);
            return ctx.scene.leave();
        }

        let message = `📊 Recent Attendance Records (Page ${page})\n\n`;
        
        records.forEach((record, index) => {
            const absentStudents = record.students
                .filter(student => student.status === 'absent')
                .map(student => student.studentName)
                .join(', ') || 'None';
            
            message += `*${(page - 1) * RECORDS_PER_PAGE + index + 1}. ${record.subject}*\n`;
            message += `   📅 ${new Date(record.date).toLocaleDateString()}\n`;
            message += `   👥 Students: ${record.totalStudents}\n`;
            message += `   ✅ Present: ${record.presentCount}\n`;
            message += `   🛑 Absent: ${record.absentCount}\n`;
            message += `   🔔 Absent Students: ${absentStudents}\n\n`;
        });

        const paginationButtons = [];
        if (page > 1) {
            paginationButtons.push(Markup.button.callback('⬅️ Previous', `records_page_${page - 1}`));
        }
        if (page * RECORDS_PER_PAGE < totalRecords) {
            paginationButtons.push(Markup.button.callback('Next ➡️', `records_page_${page + 1}`));
        }
        const actionButtons = [
            Markup.button.callback('📥 Export Attendance', 'export_attendance')
        ];
        const keyboard = paginationButtons.length > 0 
            ? Markup.inlineKeyboard([
                paginationButtons,
                actionButtons,
                [Markup.button.callback('🛑 Cancel', 'cancel_records')]
            ])
            : Markup.inlineKeyboard([
                actionButtons,
                [Markup.button.callback('🛑 Cancel', 'cancel_records')]
            ]);

        if (ctx.session.recordsMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.recordsMessageId);
            } catch (error) {
                logger.error('Failed to delete old records message', { chatId: ctx.chat.id, messageId: ctx.session.recordsMessageId, error: error.message });
            }
        }

        const newMessage = await ctx.replyWithHTML(message, keyboard);
        ctx.session.recordsMessageId = newMessage.message_id;
        ctx.session.recordsPage = page;

        setRecordsSessionTimeout(ctx);

    } catch (error) {
        logger.error('Error viewing attendance records', { error: error.message, telegramId: ctx.from.id, page });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
};

viewAttendanceRecordsScene.action(/^records_page_(\d+)$/, async (ctx) => {
    const page = parseInt(ctx.match[1]);
    if (isNaN(page) || page < 1) {
        logger.error('Invalid page number', { chatId: ctx.chat.id, page });
        ctx.reply('🛑 Invalid page number.', teacherMenu);
        return ctx.scene.leave();
    }

    await ctx.answerCbQuery();
    setRecordsSessionTimeout(ctx);
    await displayAttendanceRecords(ctx, page);
});

viewAttendanceRecordsScene.action('export_attendance', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (ctx.session.recordsMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.recordsMessageId);
        } catch (error) {
            logger.error('Failed to delete records message on export', { chatId: ctx.chat.id, messageId: ctx.session.recordsMessageId, error: error.message });
        }
        delete ctx.session.recordsMessageId;
    }

    const confirmMessage = await ctx.replyWithHTML(
        '📥 Export Attendance Records\n\n' +
        'This will export all attendance records for the last 30 days as a text file.\n' +
        'Would you like to proceed?',
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yes, Export', 'confirm_export')],
            [Markup.button.callback('🛑 Cancel', 'cancel_records')]
        ])
    );
    ctx.session.recordsMessageId = confirmMessage.message_id;
    setRecordsSessionTimeout(ctx);
});

viewAttendanceRecordsScene.action('confirm_export', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        if (ctx.session.recordsMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.recordsMessageId);
            } catch (error) {
                logger.error('Failed to delete confirmation message', { chatId: ctx.chat.id, messageId: ctx.session.recordsMessageId, error: error.message });
            }
            delete ctx.session.recordsMessageId;
        }

        const progressMessage = await ctx.reply('⏳ Generating attendance export file...');
        
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            logger.error('Teacher not found for export', { telegramId: ctx.from.id });
            await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);
            ctx.reply('🛑 Teacher not found. Please register first.', teacherMenu);
            return ctx.scene.leave();
        }

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - DAYS_LIMIT);

        const records = await Attendance.find({
            teacherId: teacher.teacherId,
            date: { $gte: thirtyDaysAgo }
        }).sort({ date: -1 });

        if (records.length === 0) {
            await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);
            ctx.reply(`📊 No attendance records found for the last ${DAYS_LIMIT} days.`, teacherMenu);
            return ctx.scene.leave();
        }

        let fileContent = `====================================\n`;
        fileContent += `      Attendance Records Export\n`;
        fileContent += `====================================\n`;
        fileContent += `Teacher: ${teacher.name}\n`;
        fileContent += `Exported on: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}\n`;
        fileContent += `Records from last ${DAYS_LIMIT} days\n`;
        fileContent += `====================================\n\n`;

        records.forEach((record, index) => {
            const absentStudents = record.students
                .filter(student => student.status === 'absent')
                .map(student => student.studentName)
                .join(', ') || 'None';
            
            fileContent += `Record ${index + 1}: ${record.subject}\n`;
            fileContent += `----------------------------------------\n`;
            fileContent += `Date: ${new Date(record.date).toLocaleDateString()}\n`;
            fileContent += `Class: ${record.className}\n`;
            fileContent += `Total Students: ${record.totalStudents}\n`;
            fileContent += `Present: ${record.presentCount}\n`;
            fileContent += `Absent: ${record.absentCount}\n`;
            fileContent += `Absent Students: ${absentStudents}\n`;
            fileContent += `----------------------------------------\n\n`;
        });

        fileContent += `====================================\n`;
        fileContent += `End of Export\n`;
        fileContent += `====================================\n`;

        const fileBuffer = Buffer.from(fileContent, 'utf-8');
        const fileName = `attendance_export_${new Date().toISOString().split('T')[0]}.txt`;

        await ctx.telegram.sendDocument(
            ctx.chat.id,
            { source: fileBuffer, filename: fileName },
            { caption: `📥 Attendance Records Exported\n\nRecords from the last ${DAYS_LIMIT} days have been exported.` }
        );

        await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);

        await displayAttendanceRecords(ctx, ctx.session.recordsPage || 1);
        setRecordsSessionTimeout(ctx);

    } catch (error) {
        logger.error('Error exporting attendance records', { error: error.message, telegramId: ctx.from.id });
        ctx.reply('🛑 An error occurred while exporting records. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

viewAttendanceRecordsScene.action('cancel_records', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (ctx.session.recordsMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.recordsMessageId);
        } catch (error) {
            logger.error('Failed to delete records message on cancel', { chatId: ctx.chat.id, messageId: ctx.session.recordsMessageId, error: error.message });
        }
    }

    ctx.reply('🛑 Attendance records view cancelled.', teacherMenu);
    delete ctx.session.recordsMessageId;
    delete ctx.session.recordsPage;
    clearTimeout(ctx.session.recordsTimeout);
    ctx.scene.leave();
});

const attendanceRemindersScene = new Scenes.BaseScene('attendance_reminders_scene');

const setRemindersSessionTimeout = (ctx) => {
    if (ctx.session.remindersTimeout) {
        clearTimeout(ctx.session.remindersTimeout);
    }
    ctx.session.remindersTimeout = setTimeout(() => {
        delete ctx.session.remindersMessageId;
        logger.error('Reminders session timeout cleared', { chatId: ctx.chat?.id });
    }, SESSION_TIMEOUT_MS);
};

attendanceRemindersScene.enter(async (ctx) => {
    if (!ctx.from?.id || typeof ctx.from.id !== 'number') {
        logger.error('Invalid telegramId', { chatId: ctx.chat?.id, telegramId: ctx.from?.id });
        ctx.reply('🛑 Invalid user ID. Please try again.', teacherMenu);
        return ctx.scene.leave();
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            logger.error('Teacher not found', { telegramId: ctx.from.id });
            ctx.reply('🛑 Teacher not found. Please register first.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `reminder_subject_${subject.replace(/ /g, '_')}`)]
        );
        subjectButtons.push([Markup.button.callback('📋 View All Reminders', 'view_reminders')]);
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_reminders')]);

        if (ctx.session.remindersMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.remindersMessageId);
            } catch (error) {
                logger.error('Failed to delete old reminders message', { chatId: ctx.chat.id, messageId: ctx.session.remindersMessageId, error: error.message });
            }
        }

        const newMessage = await ctx.replyWithHTML(
            '🔔 Attendance Reminders\n\nSelect a subject to set a reminder or view all reminders:',
            Markup.inlineKeyboard(subjectButtons)
        );
        ctx.session.remindersMessageId = newMessage.message_id;
        setRemindersSessionTimeout(ctx);

    } catch (error) {
        logger.error('Error in attendance reminders scene', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

attendanceRemindersScene.action(/^reminder_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            logger.error('Teacher not found for reminder', { telegramId: ctx.from.id });
            ctx.reply('🛑 Teacher not found. Please register first.', teacherMenu);
            return ctx.scene.leave();
        }

        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found for ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        const className = students[0].className; 

        if (ctx.session.remindersMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.remindersMessageId);
            } catch (error) {
                logger.error('Failed to delete reminders message', { chatId: ctx.chat.id, messageId: ctx.session.remindersMessageId, error: error.message });
            }
        }

        const confirmMessage = await ctx.replyWithHTML(
            `🔔 Set Attendance Reminder\n\n` +
            `Subject: ${subject}\n` +
            `Class: ${className}\n\n` +
            `Send a reminder to all parents for the next class?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Send Reminder', `send_reminder_${subject.replace(/ /g, '_')}_${className.replace(/ /g, '_')}`)],
                [Markup.button.callback('🛑 Cancel', 'cancel_reminders')]
            ])
        );
        ctx.session.remindersMessageId = confirmMessage.message_id;
        setRemindersSessionTimeout(ctx);

    } catch (error) {
        logger.error('Error selecting subject for reminder', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

attendanceRemindersScene.action(/^send_reminder_(.+)_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    const className = ctx.match[2].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            logger.error('Teacher not found for sending reminder', { telegramId: ctx.from.id });
            ctx.reply('🛑 Teacher not found. Please register first.', teacherMenu);
            return ctx.scene.leave();
        }

        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject,
            className: className
        });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found for ${subject} in ${className}.`, teacherMenu);
            return ctx.scene.leave();
        }

        if (ctx.session.remindersMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.remindersMessageId);
            } catch (error) {
                logger.error('Failed to delete reminders message on send', { chatId: ctx.chat.id, messageId: ctx.session.remindersMessageId, error: error.message });
            }
        }

        const progressMessage = await ctx.reply('⏳ Sending attendance reminders...');

        let notifiedCount = 0;
        for (const student of students) {
            const studentRecord = await Student.findOne({ studentId: student.studentId });
            if (studentRecord && studentRecord.parentId) {
                try {
                    await ctx.telegram.sendMessage(
                        studentRecord.parentId,
                        `🔔 Attendance Reminder\n\n` +
                        `Dear Parent,\n` +
                        `Please ensure your child, ${student.studentName}, attends the upcoming ${subject} class for ${className}.\n` +
                        `📅 Date: ${new Date().toLocaleDateString()}\n` +
                        `If you have any questions, contact the school.`,
                        { parse_mode: "HTML" }
                    );
                    notifiedCount++;
                } catch (error) {
                    logger.error('Failed to send reminder to parent', { studentId: student.studentId, error: error.message });
                }
            }
        }

        await ctx.telegram.deleteMessage(ctx.chat.id, progressMessage.message_id);

        ctx.replyWithHTML(
            `✅ Reminders Sent Successfully!\n\n` +
            `📚 Subject: ${subject}\n` +
            `🏫 Class: ${className}\n` +
            `📬 Parents Notified: ${notifiedCount}/${students.length}`,
            teacherMenu
        );

        delete ctx.session.remindersMessageId;
        clearTimeout(ctx.session.remindersTimeout);
        ctx.scene.leave();

    } catch (error) {
        logger.error('Error sending reminders', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred while sending reminders. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

attendanceRemindersScene.action('view_reminders', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        if (ctx.session.remindersMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.remindersMessageId);
            } catch (error) {
                logger.error('Failed to delete reminders message on view', { chatId: ctx.chat.id, messageId: ctx.session.remindersMessageId, error: error.message });
            }
        }

        const message = await ctx.replyWithHTML(
            '🔔 Attendance Reminders\n\n' +
            'No reminders are currently scheduled.\n' +
            'Select a subject to set a new reminder.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Back', 'back_to_reminders')],
                [Markup.button.callback('🛑 Cancel', 'cancel_reminders')]
            ])
        );
        ctx.session.remindersMessageId = message.message_id;
        setRemindersSessionTimeout(ctx);

    } catch (error) {
        logger.error('Error viewing reminders', { error: error.message, telegramId: ctx.from?.id });
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

attendanceRemindersScene.action('back_to_reminders', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('attendance_reminders_scene');
});

attendanceRemindersScene.action('cancel_reminders', async (ctx) => {
    await ctx.answerCbQuery();
    
    if (ctx.session.remindersMessageId) {
        try {
            await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.remindersMessageId);
        } catch (error) {
            logger.error('Failed to delete reminders message on cancel', { chatId: ctx.chat.id, messageId: ctx.session.remindersMessageId, error: error.message });
        }
    }

    ctx.reply('🛑 Attendance reminders cancelled.', teacherMenu);
    delete ctx.session.remindersMessageId;
    clearTimeout(ctx.session.remindersTimeout);
    ctx.scene.leave();
});

stage.register(teacherAttendanceScene);
stage.register(viewAttendanceRecordsScene);
stage.register(attendanceRemindersScene);


// Admin Search Scene
const adminSearchScene = new Scenes.BaseScene('admin_search_scene');

adminSearchScene.enter(async (ctx) => {
    try {
        
        ctx.reply(
            '🔍 Admin Search System\n\n' +
            'Select what you want to search:',
            Markup.inlineKeyboard([
                [Markup.button.callback('👨‍🏫 Teachers', 'search_teachers')],
                [Markup.button.callback('👨‍👩‍👧‍👦 Parents', 'search_parents')],
                [Markup.button.callback('👨‍🎓 Students', 'search_students')],
                [Markup.button.callback('🛑 Cancel', 'cancel_search')]
            ])
        );
    } catch (error) {
        console.error('Error in admin search scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', adminMenu);
        ctx.scene.leave();
    }
});

adminSearchScene.action(/^search_(teachers|parents|students)$/, async (ctx) => {
    const category = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        ctx.session.searchCategory = category;
        ctx.session.searchPage = 0;
        ctx.session.searchQuery = '';
        ctx.session.searchResults = [];
        
        ctx.reply(
            `🔍 Searching ${category}:\n\n` +
            'Please enter a name or ID to search. For names, type the starting letter(s).',
            Markup.keyboard([['🛑 Cancel Search']]).resize()
        );
        
        ctx.scene.enter('admin_search_input_scene');
    } catch (error) {
        console.error('Error selecting search category:', error);
        ctx.reply('🛑 An error occurred. Please try again.', adminMenu);
        ctx.scene.leave();
    }
});

adminSearchScene.action('cancel_search', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Search cancelled.', adminMenu);
    ctx.scene.leave();
});

// Search Input Scene
const adminSearchInputScene = new Scenes.BaseScene('admin_search_input_scene');

adminSearchInputScene.enter((ctx) => {
});
adminSearchInputScene.on('text', async (ctx) => {
    const query = ctx.message.text.trim();

    if (query === '🛑 Cancel Search') {
        ctx.reply('🛑 Search cancelled.', adminMenu);
        delete ctx.session.searchCategory;
        delete ctx.session.searchQuery;
        delete ctx.session.searchResults;
        delete ctx.session.searchPage;
        return ctx.scene.leave();
    }

    if (!query) {
        ctx.reply('🛑 Please enter a search query.');
        return;
    }

    try {
        ctx.session.searchQuery = query;
        ctx.session.searchPage = 0;

        const regexQuery = { $regex: query, $options: 'i' };

        let results = [];

        switch (ctx.session.searchCategory) {
            case 'teachers':
                results = await Teacher.find({ teacherId: regexQuery }).exec();
                if (results.length === 0) {
                    results = await Teacher.find({ name: regexQuery }).exec();
                }
                break;

            case 'parents':
                results = await User.find({ role: 'parent', telegramId: regexQuery }).exec();
                if (results.length === 0) {
                    results = await User.find({ role: 'parent', name: regexQuery }).exec();
                }
                break;

            case 'students':
                results = await Student.find({ studentId: regexQuery }).exec();
                if (results.length === 0) {
                    results = await Student.find({ name: regexQuery }).exec();
                }
                break;
        }

        ctx.session.searchResults = results;

        if (results.length === 0) {
            ctx.reply(
                `🛑 No ${ctx.session.searchCategory} found matching "${query}".\n\n` +
                'Please try a different search term.',
                Markup.keyboard([['🛑 Cancel Search']]).resize()
            );
            return;
        }

        await logAdminAction(ctx, 'SEARCH_EXECUTED', {
            category: ctx.session.searchCategory,
            query,
            resultCount: results.length
        });

        await displaySearchResults0(ctx);

    } catch (error) {
        console.error('Error performing search:', error);
        ctx.reply('🛑 An error occurred during search. Please try again.', adminMenu);
        ctx.scene.leave();
    }
});


const displaySearchResults0 = async (ctx) => {
    const { searchResults, searchPage, searchCategory, searchQuery } = ctx.session;
    const totalPages = Math.ceil(searchResults.length / 10);
    const startIdx = searchPage * 10;
    const endIdx = Math.min(startIdx + 10, searchResults.length);
    const currentResults = searchResults.slice(startIdx, endIdx);
    
    let message = `🔍 Search Results for "${searchQuery}"\n\n`;
    message += `📋 Category: ${searchCategory}\n`;
    message += `📊 Results: ${searchResults.length} found\n`;
    message += `📄 Page ${searchPage + 1} of ${totalPages}\n\n`;
    
    currentResults.forEach((result, index) => {
        const globalIndex = startIdx + index + 1;
        
        switch (searchCategory) {
            case 'teachers':
                message += `${globalIndex}. *${result.name}*\n`;
                message += `   🆔 ID: ${result.teacherId}\n`;
                message += `   📚 Subjects: ${result.subjects?.join(', ') || 'None'}\n`;
                message += `   📱 Telegram: ${result.telegramId || 'Not linked'}\n\n`;
                break;
                
            case 'parents':
                message += `${globalIndex}. *${result.name}*\n`;
                message += `   🆔 ID: ${result.telegramId}\n`;
                message += `   👥 Students: ${result.studentIds?.length || 0}\n`;
                if (result.username) {
                    message += `   👤 Username: @${result.username}\n`;
                }
                message += '\n';
                break;
                
            case 'students':
                message += `${globalIndex}. *${result.name}*\n`;
                message += `   🆔 ID: <code>${result.studentId}</code>\n`;
                message += `   🏫 Class: ${result.class}\n`;
                message += `   👪 Parent: ${result.parentId ? 'Linked' : 'Not linked'}\n\n`;
                break;
        }
    });
    
    const paginationButtons = [];
    
    if (searchPage > 0) {
        paginationButtons.push(Markup.button.callback('⬅️ Previous', 'search_prev_page'));
    }
    
    if (searchPage < totalPages - 1) {
        paginationButtons.push(Markup.button.callback('Next ➡️', 'search_next_page'));
    }
    
    const actionButtons = [
        [Markup.button.callback('🔄 New Search', 'search_new')],
        [Markup.button.callback('✅ Done', 'search_done')]
    ];
    
    if (paginationButtons.length > 0) {
        actionButtons.unshift(paginationButtons);
    }
    
    if (ctx.session.searchMessageId) {
        try {
            await ctx.telegram.editMessageText(
                ctx.chat.id,
                ctx.session.searchMessageId,
                null,
                message,
                {
                    parse_mode: 'HTML',
                    reply_markup: Markup.inlineKeyboard(actionButtons).reply_markup
                }
            );
        } catch (error) {
            const newMessage = await ctx.replyWithHTML(
                message,
                Markup.inlineKeyboard(actionButtons)
            );
            ctx.session.searchMessageId = newMessage.message_id;
        }
    } else {
        const newMessage = await ctx.replyWithHTML(
            message,
            Markup.inlineKeyboard(actionButtons)
        );
        ctx.session.searchMessageId = newMessage.message_id;
    }
};

adminSearchInputScene.action('search_prev_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.searchPage--;
    await displaySearchResults0(ctx);
});

adminSearchInputScene.action('search_next_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.searchPage++;
    await displaySearchResults0(ctx);
});

adminSearchInputScene.action('search_new', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.searchMessageId;
    ctx.scene.enter('admin_search_scene');
});

adminSearchInputScene.action('search_done', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('✅ Search completed.', adminMenu);
    delete ctx.session.searchCategory;
    delete ctx.session.searchQuery;
    delete ctx.session.searchResults;
    delete ctx.session.searchPage;
    delete ctx.session.searchMessageId;
    ctx.scene.leave();
});

stage.register(adminSearchScene);
stage.register(adminSearchInputScene);


// --- Remove Student Scene ---
const removeStudentScene = new Scenes.BaseScene('remove_student_scene');

removeStudentScene.enter(async (ctx) => {
    try {
        
        await notifyMasterAdmin(ctx, 'remove_student_initiated', {
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id
        });
        
        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel']
        ]).oneTime().resize();
        
        await ctx.reply(
            '➖ Enter the Student ID (format: STXXXX) to remove:',
            cancelKeyboard
        );
    } catch (error) {
        console.error('Error entering remove student scene:', error);
        await notifyMasterAdmin(ctx, 'remove_student_error', { 
            error: error.message,
            adminId: ctx.from.id
        });
        await ctx.reply('🛑 An error occurred.', adminMenu);
        await ctx.scene.leave();
    }
});

removeStudentScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim();
    const studentIdInSession = ctx.session.studentToRemove;

    if (input === '🛑 Cancel') {
        await notifyMasterAdmin(ctx, 'remove_student_cancelled', { 
            studentId: studentIdInSession || 'N/A', // Log the ID if available
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id
        });
        await ctx.reply('🛑 Student removal cancelled.', adminMenu);
        delete ctx.session.studentToRemove;
        return ctx.scene.leave();
    }

    if (studentIdInSession) {
        const confirmationInput = input.toUpperCase();

        if (confirmationInput !== 'CONFIRM') {
            return ctx.reply('🛑 Please type CONFIRM to proceed or select "🛑 Cancel".');
        }

        try {
            const studentId = studentIdInSession; // Use the ID from the session
            
            const student = await getStudentById(studentId);
            if (!student) {
                await ctx.reply('🛑 Student not found.', adminMenu);
                delete ctx.session.studentToRemove;
                return ctx.scene.leave();
            }

            const teacherRelations = await TeacherStudent.find({ studentId: studentId });
            const relationsCount = teacherRelations.length;
            const gradeCount = await Grade.countDocuments({ studentId: studentId });
            
            const masterAdminMsg = await notifyMasterAdmin(ctx, 'remove_student_started', { 
                studentId,
                admin: ctx.from.first_name || 'Admin',
                adminId: ctx.from.id
            });

            let unlinkedParent = false;
            if (student.parentId) {
                const parent = await getUserById(student.parentId);
                if (parent) {
                    parent.studentIds = parent.studentIds.filter(id => id !== studentId);
                    if (parent.studentIds.length === 0) {
                        parent.role = 'user';
                    }
                    await parent.save();
                    unlinkedParent = true;
                }
            }
            
            await TeacherStudent.deleteMany({ studentId: studentId });
            await Grade.deleteMany({ studentId: studentId });
            await Student.deleteOne({ studentId: studentId });
            
            await logAdminAction(ctx, 'REMOVE_STUDENT', {
                studentId: student.studentId,
                studentName: student.name,
                class: student.class,
                unlinkedParent: unlinkedParent,
                removedRelations: relationsCount,
                removedGrades: gradeCount
            });

            await notifyMasterAdmin(ctx, 'remove_student_completed', {
                studentId,
                studentName: student.name,
                unlinkedParent: unlinkedParent ? 'Yes' : 'No',
                deletedRelations: relationsCount, 
                deletedGrades: gradeCount, 
                admin: ctx.from.first_name || 'Admin',
                adminId: ctx.from.id
            }, masterAdminMsg?.message_id);
            
            await ctx.reply(
                `✅ Student removed successfully!\n` +
                `👤 Name: ${student.name}\n` +
                `🆔 ID: ${studentId}\n` +
                `👪 Parent Unlinked: ${unlinkedParent ? 'Yes' : 'No'}\n` +
                `📚 Relationships Removed: ${relationsCount}\n` + 
                `💯 Grades Removed: ${gradeCount}`, 
                adminMenu
            );
            
        } catch (error) {
            console.error('Error removing student:', error);
            await notifyMasterAdmin(ctx, 'remove_student_error', { 
                error: error.message,
                adminId: ctx.from.id,
                studentId: studentIdInSession
            });
            await ctx.reply('🛑 An error occurred while removing the student.', adminMenu);
        }
        
        delete ctx.session.studentToRemove;
        return ctx.scene.leave();
    }

    // --- Step 1: Student ID Input (Initial entry/no ID in session) ---

    if (!isValidStudentId(input)) {
        return ctx.reply('🛑 Invalid Student ID format. Please enter a valid ID (e.g., ST1234) or select "🛑 Cancel".');
    }
    
    try {
        const student = await getStudentById(input);
        if (!student) {
            await ctx.reply('🛑 Student not found with this ID.', adminMenu);
            return ctx.scene.leave();
        }
        
        ctx.session.studentToRemove = student.studentId;
        
        const parent = student.parentId ? await getUserById(student.parentId) : null;
        const teacherRelations = await TeacherStudent.find({ studentId: student.studentId });
        const grades = await Grade.find({ studentId: student.studentId });
        
        let confirmMessage = `⚠️ *CONFIRM STUDENT REMOVAL*\n\n` +
            `👤 Name: ${student.name}\n` +
            `🆔 ID: ${student.studentId}\n` +
            `🏫 Class: ${student.class}\n` +
            `👪 Parent: ${parent ? parent.name : 'None'}\n` +
            `📚 Teacher Relationships: ${teacherRelations.length}\n` +
            `💯 Grades: ${grades.length}\n\n` +
            `*This will permanently delete:*\n` +
            `• The student record\n` +
            `• All linked grades\n` +
            `• All teacher relationships\n` +
            `• Unlink from parent if applicable\n\n` +
            `*This action cannot be undone!*\n\n` +
            `Type CONFIRM to proceed or select "🛑 Cancel":`;
        
        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel']
        ]).oneTime().resize();
        
        await ctx.replyWithHTML(confirmMessage, cancelKeyboard);
        
    } catch (error) {
        console.error('Error preparing student removal:', error);
        
        await notifyMasterAdmin(ctx, 'remove_student_error', { 
            error: error.message,
            adminId: ctx.from.id
        });
        await ctx.reply('🛑 An error occurred.', adminMenu);
        delete ctx.session.studentToRemove;
        await ctx.scene.leave();
    }
});

stage.register(removeStudentScene);

const deleteClassScene = new Scenes.BaseScene('delete_class_scene');
const BATCH_SIZE = 20; 
const PROGRESS_UPDATE_INTERVAL = 5000; 

deleteClassScene.enter(async (ctx) => {
    try {
        await notifyMasterAdmin(ctx, 'delete_class_initiated', {
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id
        });

        const availableClasses = await getUniqueClasses();
        if (availableClasses.length === 0) {
            ctx.reply('🛑 No classes found to delete.', adminMenu);
            return ctx.scene.leave();
        }

        const classButtons = availableClasses.map(className =>
            [Markup.button.callback(className, `delete_class_${encodeURIComponent(className)}`)]
        );
        classButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_delete_class')]);

        ctx.reply('⚠️ *WARNING: This will permanently delete ALL data for the selected class!*\n\nSelect a class to delete:',
            Markup.inlineKeyboard(classButtons));
    } catch (error) {
        console.error('Error retrieving classes for deletion:', error);
        await notifyMasterAdmin(ctx, 'delete_class_error', { error: error.message, adminId: ctx.from.id });
        ctx.reply('🛑 An error occurred while retrieving classes.', adminMenu);
        ctx.scene.leave();
    }
});

deleteClassScene.action(/^delete_class_(.+)$/, async (ctx) => {
    const className = decodeURIComponent(ctx.match[1]);
    await ctx.answerCbQuery();
    ctx.session.classToDelete = className;

    try {
        const studentCount = await Student.countDocuments({ class: className });
        const teacherRelationsCount = await TeacherStudent.countDocuments({ className });

        ctx.replyWithHTML(
            `⚠️ *CONFIRM CLASS DELETION*\n\n` +
            `🏫 Class: *${className}*\n` +
            `👥 Students: ${studentCount}\n` +
            `📚 Teacher Relationships: ${teacherRelationsCount}\n\n` +
            `*This will permanently delete:*\n` +
            `• All students in this class\n` +
            `• All parent links for these students\n` +
            `• All teacher-student relationships for this class\n\n` +
            `*This action cannot be undone!*\n\n` +
            `Type CONFIRM to proceed or CANCEL to abort:`
        );
    } catch (error) {
        console.error('Error preparing class deletion:', error);
        await notifyMasterAdmin(ctx, 'delete_class_preparation_error', { className, error: error.message, adminId: ctx.from.id });
        ctx.reply('🛑 An error occurred.', adminMenu);
        ctx.scene.leave();
    }
});

deleteClassScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim().toUpperCase();
    const className = ctx.session.classToDelete;

    if (!className) {
        ctx.reply('🛑 No class selected. Please start over.', adminMenu);
        return ctx.scene.leave();
    }

    if (input === 'CANCEL') {
        await notifyMasterAdmin(ctx, 'delete_class_cancelled', { className, admin: ctx.from.first_name || 'Admin', adminId: ctx.from.id });
        ctx.reply('🛑 Class deletion cancelled.', adminMenu);
        delete ctx.session.classToDelete;
        return ctx.scene.leave();
    }

    if (input !== 'CONFIRM') {
        ctx.reply('🛑 Please type CONFIRM to proceed or CANCEL to abort.(ALL IN UPPERCASE)');
        return;
    }

    try {
        const masterAdminMsg = await notifyMasterAdmin(ctx, 'delete_class_started', {
            className,
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id,
            status: 'processing'
        });

        const students = await Student.find({ class: className });
        const totalStudents = students.length;
        let deletedStudents = 0;
        let unlinkedParents = 0;
        const studentDetails = [];
        const parentDetails = [];

        const progressMsg = await ctx.reply(`⏳ Starting deletion process for ${className}\n📊 Total students: ${totalStudents}`);

        const startTime = Date.now();
        let lastUpdateTime = startTime;

        for (let i = 0; i < totalStudents; i += BATCH_SIZE) {
            const batch = students.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (student) => {
                studentDetails.push({ studentId: student.studentId, studentName: student.name });

                if (student.parentId) {
                    const parent = await getUserById(student.parentId);
                    if (parent) {
                        parent.studentIds = parent.studentIds.filter(id => id !== student.studentId);
                        if (parent.studentIds.length === 0) parent.role = 'user';
                        await parent.save();
                        unlinkedParents++;
                        parentDetails.push({ parentId: parent.telegramId, parentName: parent.name, studentId: student.studentId });
                    }
                }

                await Student.deleteOne({ studentId: student.studentId });
                deletedStudents++;
            }));

            const now = Date.now();
            if (now - lastUpdateTime > PROGRESS_UPDATE_INTERVAL) {
                const elapsed = (now - startTime) / 1000;
                const speed = deletedStudents / elapsed;
                const remaining = totalStudents - deletedStudents;
                const eta = speed > 0 ? Math.round(remaining / speed) : 0;

                try {
                    await ctx.telegram.editMessageText(progressMsg.chat.id, progressMsg.message_id, null,
                        `⏳ Deleting class: ${className}\n` +
                        `📊 Progress: ${deletedStudents}/${totalStudents} students\n` +
                        `✅ Completed: ${Math.round((deletedStudents / totalStudents) * 100)}%\n` +
                        `⏰ ETA: ${formatTime(eta)}\n` +
                        `🏎️ Speed: ${speed.toFixed(1)} students/sec`
                    );
                    await notifyMasterAdmin(ctx, 'delete_class_progress', {
                        className,
                        progress: deletedStudents,
                        total: totalStudents,
                        percentage: Math.round((deletedStudents / totalStudents) * 100),
                        eta: formatTime(eta),
                        speed: speed.toFixed(1),
                        adminId: ctx.from.id,
                        messageId: masterAdminMsg?.message_id
                    }, masterAdminMsg?.message_id);
                } catch {}
                lastUpdateTime = now;
            }
        }

        const teacherRelations = await TeacherStudent.find({ className });
        const deletedTeacherRelations = teacherRelations.length;
        await TeacherStudent.deleteMany({ className });

        

      
        await ctx.telegram.editMessageText(progressMsg.chat.id, progressMsg.message_id, null,
            `✅ Class deletion completed!\n🏫 Class: ${className}\n👥 Students deleted: ${deletedStudents}\n👨‍👩‍👧‍👦 Parents unlinked: ${unlinkedParents}\n📚 Teacher relationships removed: ${deletedTeacherRelations}\n⏱️ Total time: ${formatTime((Date.now() - startTime) / 1000)}`
        );
await logAdminAction(ctx, 'DELETE_CLASS', {
  className,
  deletedStudents,
  unlinkedParents,
  deletedTeacherRelations,
});

        await notifyMasterAdmin(ctx, 'delete_class_completed', {
            className,
            statistics: { deletedStudents, unlinkedParents, deletedTeacherRelations },
            totalTime: formatTime((Date.now() - startTime) / 1000),
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id,
        });


    } catch (error) {
        console.error('Error deleting class:', error);
        await notifyMasterAdmin(ctx, 'delete_class_error', { className, error: error.message, adminId: ctx.from.id });
        ctx.reply('🛑 An error occurred while deleting the class.', adminMenu);
    }

    delete ctx.session.classToDelete;
    ctx.scene.leave();
});

deleteClassScene.action('cancel_delete_class', async (ctx) => {
    await ctx.answerCbQuery();
    const className = ctx.session.classToDelete;
    await notifyMasterAdmin(ctx, 'delete_class_cancelled', { className, admin: ctx.from.first_name || 'Admin', adminId: ctx.from.id });
    ctx.reply('🛑 Class deletion cancelled.', adminMenu);
    delete ctx.session.classToDelete;
    ctx.scene.leave();
});

function formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)} seconds`;
    else if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    else { const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return `${hours}h ${minutes}m`; }
}

stage.register(deleteClassScene);





// --- Master Admin Scenes ---

// View All Admins Scene
const viewAllAdminsScene = new Scenes.BaseScene('view_all_admins_scene');

viewAllAdminsScene.enter(async (ctx) => {
    try {
        const admins = await User.find({ role: 'admin' }).sort({ createdAt: 1 });
        
        if (admins.length === 0) {
            ctx.reply('🛑 No admins found.', masterAdminMenu);
            return ctx.scene.leave();
        }

        let message = '👑 All Administrators:\n\n';
        
        admins.forEach((admin, index) => {
            const isMaster = admin.telegramId === process.env.MASTER_ADMIN_ID;
            message += `${index + 1}. ${admin.name} \n`;
            message += `   🆔 ID: ${admin.telegramId}\n`;
            message += `   👑 Role: ${isMaster ? 'Master Admin' : 'Admin'}\n`;
            message += `   📅 Registered: ${new Date(admin.createdAt).toLocaleDateString()}\n`;
            message += `   ⏰ Last Active: ${admin.lastActivity ? new Date(admin.lastActivity).toLocaleString() : 'Never'}\n`;
            message += `   📊 Activities: ${admin.activityLog?.length || 0} logged\n\n`;
        });

        ctx.replyWithHTML(message, masterAdminMenu);
        
    } catch (error) {
        console.error('Error viewing admins:', error);
        ctx.reply('🛑 Error retrieving admin list.', masterAdminMenu);
    }
    ctx.scene.leave();
});



// --- REMOVE ADMIN SCENE (MASTER ADMIN ONLY) ---
const removeAdminScene = new Scenes.BaseScene('remove_admin_scene');

removeAdminScene.action('cancel_remove_admin', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('🛑 Admin removal cancelled.', masterAdminMenu);
    delete ctx.session.adminToRemove;
    ctx.scene.leave();
});

removeAdminScene.enter(async (ctx) => {
    try {
        const masterAdminId = String(process.env.MASTER_ADMIN_ID);

        if (String(ctx.from.id) !== masterAdminId) {
            await ctx.reply('🛑 Unauthorized: Only the master admin can remove admins.');
            return ctx.scene.leave();
        }

        let admins = await User.find({ role: 'admin' });

        admins = admins.filter(a => String(a.telegramId) !== masterAdminId);

        admins.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        if (!admins || admins.length === 0) {
            await ctx.reply('🛑 No removable admins found.', masterAdminMenu);
            return ctx.scene.leave();
        }

        const adminButtons = admins.map(admin => [
            Markup.button.callback(
                `${admin.name || 'Unnamed'} (ID: ${admin.telegramId})`,
                `select_admin_id_${admin.telegramId}` 
            )
        ]);

        adminButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_remove_admin')]);

        await ctx.reply('🗑️ Select an admin to remove:', Markup.inlineKeyboard(adminButtons));

    } catch (error) {
        console.error('Error in remove admin scene:', error);
        await ctx.reply('🛑 Error loading admins.', masterAdminMenu);
        ctx.scene.leave();
    }
});

removeAdminScene.action(/^select_admin_id_(\d+)$/, async (ctx) => {
    const adminId = ctx.match[1];
    await ctx.answerCbQuery();

    try {
        const masterAdminId = String(process.env.MASTER_ADMIN_ID);

        if (String(adminId) === masterAdminId) {
            await ctx.editMessageText('🛑 Cannot remove the master admin.', masterAdminMenu);
            return ctx.scene.leave();
        }

        const adminToRemove =
            await User.findOne({ telegramId: String(adminId), role: 'admin' }) ||
            await User.findOne({ telegramId: Number(adminId), role: 'admin' });

        if (!adminToRemove) {
            await ctx.editMessageText('🛑 Admin not found or role changed.', masterAdminMenu);
            return ctx.scene.leave();
        }

        ctx.session.adminToRemove = {
            telegramId: adminToRemove.telegramId,
            name: adminToRemove.name || 'Unknown'
        };

        const confirmationText = `⚠️ *CONFIRM ADMIN REMOVAL*\n\n` +
            `You are about to remove the following administrator:\n` +
            `👤 Name: *${adminToRemove.name || 'Unknown'}*\n` +
            `🆔 ID: \`${adminToRemove.telegramId}\`\n\n` +
            `*This action will revoke their admin privileges and is highly sensitive.*\n\n` +
            `Are you sure you want to proceed?`;

        const confirmKeyboard = Markup.inlineKeyboard([
            Markup.button.callback('✅ Confirm Removal', 'remove_admin_final_confirm'),
            Markup.button.callback('🛑 Cancel', 'remove_admin_final_cancel')
        ]);
        
        await ctx.editMessageText(confirmationText, {
            parse_mode: 'Markdown',
            reply_markup: confirmKeyboard.reply_markup
        });

    } catch (error) {
        console.error('Error setting up admin removal confirmation:', error);
        await ctx.editMessageText('🛑 Error preparing removal confirmation.', masterAdminMenu);
        delete ctx.session.adminToRemove;
        ctx.scene.leave();
    }
});


removeAdminScene.action('remove_admin_final_confirm', async (ctx) => {
    await ctx.answerCbQuery('Removing admin...');
    const adminData = ctx.session.adminToRemove;

    if (!adminData || !adminData.telegramId) {
        await ctx.editMessageText('🛑 Session expired or no admin selected. Please start over.', masterAdminMenu);
        return ctx.scene.leave();
    }
    
    const adminId = adminData.telegramId;
    
    try {
        const adminToRemove =
            await User.findOne({ telegramId: String(adminId), role: 'admin' }) ||
            await User.findOne({ telegramId: Number(adminId), role: 'admin' });

        if (!adminToRemove) {
            await ctx.editMessageText('🛑 Admin not found or role already changed.', masterAdminMenu);
            delete ctx.session.adminToRemove;
            return ctx.scene.leave();
        }

        await User.updateOne(
            { telegramId: adminToRemove.telegramId },
            {
                $set: {
                    role: 'user',
                    adminId: null,
                    updatedAt: new Date()
                }
            }
        );

        await ctx.editMessageText(
            `✅ <b>Admin removed successfully!</b>\n\n` +
            `👤 <b>${adminToRemove.name || 'Unknown'}</b>\n` +
            `🆔 ${adminToRemove.telegramId}\n` +
            `⏰ ${new Date().toLocaleString()}`,
            { parse_mode: 'HTML', reply_markup: masterAdminMenu.reply_markup }
        );

        try {
            await ctx.telegram.sendMessage(
                adminToRemove.telegramId,
                `ℹ️ Your administrator privileges have been removed by the master admin.`
            );
        } catch (notifyError) {
            console.error('Could not notify removed admin:', notifyError);
        }

        await logAdminAction(ctx, 'REMOVE_ADMIN', {
            removedAdmin: adminToRemove.name,
            removedId: adminToRemove.telegramId,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Error performing final admin removal:', error);
        await ctx.editMessageText('🛑 Error removing admin.', masterAdminMenu);
    }

    delete ctx.session.adminToRemove;
    ctx.scene.leave();
});


removeAdminScene.action('remove_admin_final_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('🛑 Admin removal cancelled at the confirmation stage.', masterAdminMenu);
    delete ctx.session.adminToRemove;
    ctx.scene.leave();
});

stage.register(removeAdminScene);

removeAdminScene.action('cancel_remove_admin', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 Admin removal cancelled.', masterAdminMenu);
  ctx.scene.leave();
});

stage.register(removeAdminScene);

// Admin Activities Scene
const adminActivitiesScene = new Scenes.BaseScene('admin_activities_scene')

adminActivitiesScene.action('view_full_activities', async (ctx) => {
    await ctx.answerCbQuery();
    
    try {
        const admins = await User.find({ role: 'admin' }).sort({ name: 1 });
        
        const allActivities = [];
        admins.forEach(admin => {
            if (admin.activityLog && admin.activityLog.length > 0) {
                admin.activityLog.forEach(activity => {
                    allActivities.push({
                        admin: admin.name,
                        adminId: admin.telegramId,
                        timestamp: activity.timestamp,
                        action: activity.action,
                        details: activity.details
                    });
                });
            }
        });

        allActivities.sort((a, b) => b.timestamp - a.timestamp);
        
        if (allActivities.length === 0) {
            await ctx.reply('🛑 No activities found in the log.');
            return;
        }

        let logContent = `SCHOOL SYSTEM BOT - FULL ADMIN ACTIVITY LOG\n`;
        logContent += `Generated: ${new Date().toLocaleString()}\n`;
        logContent += `Total Activities: ${allActivities.length}\n`;
        logContent += '='.repeat(80) + '\n\n';
        
        const activitiesByAdmin = {};
        allActivities.forEach(activity => {
            if (!activitiesByAdmin[activity.admin]) {
                activitiesByAdmin[activity.admin] = [];
            }
            activitiesByAdmin[activity.admin].push(activity);
        });

        logContent += 'SUMMARY:\n';
        logContent += '='.repeat(80) + '\n';
        Object.keys(activitiesByAdmin).forEach(adminName => {
            logContent += `• ${adminName}: ${activitiesByAdmin[adminName].length} activities\n`;
        });
        logContent += '\n';

        Object.keys(activitiesByAdmin).forEach(adminName => {
            const adminActivities = activitiesByAdmin[adminName];
            
            logContent += `ADMIN: ${adminName} (ID: ${adminActivities[0].adminId})\n`;
            logContent += '-'.repeat(80) + '\n';
            
            adminActivities.forEach((activity, index) => {
                logContent += `Activity ${index + 1}:\n`;
                logContent += `  Time: ${new Date(activity.timestamp).toLocaleString()}\n`;

                logContent += `  Action: ${activity.action}\n`;
                
                if (activity.details) {
                    if (activity.details.messageText) {
                        logContent += `  Message: ${activity.details.messageText}\n`;
                    }
                    if (activity.details.command) {
                        logContent += `  Command: ${activity.details.command}\n`;
                    }
                    if (activity.details.removedAdmin) {
                        logContent += `  Removed Admin: ${activity.details.removedAdmin}\n`;
                    }
                    if (activity.details.promotedUser) {
                        logContent += `  Promoted User: ${activity.details.promotedUser}\n`;
                    }
                    if (activity.details.chatType) {
                        logContent += `  Chat Type: ${activity.details.chatType}\n`;
                    }
                    if (activity.details?.uploadedFile) {
                        logContent += `  📤 Uploaded: ${activity.details.uploadedFile.name} (Class: ${activity.details.uploadedFile.class})\n`;
                    }
                    if (activity.details?.removedFileId) {
                        logContent += `  🗑️ Removed Uploaded File ID: ${activity.details.removedFileId}\n`;
                    }
                    if (activity.details?.model) {
                        logContent += `  ⚙️ DB Change: ${activity.details.model}.${activity.details.operation} (Target: ${activity.details.targetId})\n`;
                    }

                }
                
                logContent += '\n';
            });
            
            logContent += '\n';
        });

        logContent += 'STATISTICS:\n';
        logContent += '='.repeat(80) + '\n';
        
        const actionCounts = {};
        allActivities.forEach(activity => {
            actionCounts[activity.action] = (actionCounts[activity.action] || 0) + 1;
        });
        
        logContent += 'Actions by Type:\n';
        Object.keys(actionCounts).sort().forEach(action => {
            logContent += `  ${action}: ${actionCounts[action]}\n`;
        });
        
        logContent += '\nActivity Timeline:\n';
        const firstActivity = allActivities[allActivities.length - 1];
        const lastActivity = allActivities[0];
        const firstActivityDate = new Date(firstActivity.timestamp);
const lastActivityDate = new Date(lastActivity.timestamp);

logContent += `  First Activity: ${firstActivityDate.toLocaleString()}\n`;
logContent += `  Last Activity: ${lastActivityDate.toLocaleString()}\n`;
logContent += `  Time Span: ${Math.round((lastActivityDate - firstActivityDate) / (1000 * 60 * 60 * 24))} days\n`;

        const tempDir = './temp_logs';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const fileName = `admin_activities_full_${new Date().toISOString().split('T')[0]}.log`;
        const filePath = path.join(tempDir, fileName);
        
        fs.writeFileSync(filePath, logContent);

        await ctx.replyWithDocument({
            source: filePath,
            filename: fileName,
            caption: `📋 Full Admin Activity Log\n📊 ${allActivities.length} activities total`
        });

        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (cleanupError) {
                    console.error('Error cleaning up log file:', cleanupError);
                }
            }
        }, 30000); 

    } catch (error) {
        console.error('Error generating full activity log:', error);
        await ctx.reply('🛑 Error generating activity log. Please try again.');
    }
});

adminActivitiesScene.action('back_to_master_menu', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('Returning to master admin menu...', masterAdminMenu);
    ctx.scene.leave();
});


adminActivitiesScene.enter(async (ctx) => {
    try {
        const admins = await User.find({ role: 'admin' }).sort({ lastActivity: -1 });
        
        let message = '📊 RECENT ADMIN ACTIVITIES\n\n';
        
        const allActivities = [];
        admins.forEach(admin => {
            if (admin.activityLog && admin.activityLog.length > 0) {
                admin.activityLog.forEach(activity => {
                    allActivities.push({
                        admin: admin.name,
                        timestamp: activity.timestamp,
                        action: activity.action,
                        details: activity.details
                    });
                });
            }
        });

        allActivities.sort((a, b) => b.timestamp - a.timestamp);
        
        const recentActivities = allActivities.slice(0, 10);
        
        if (recentActivities.length === 0) {
            message += 'No recent activities found.';
        } else {
            recentActivities.forEach((activity, index) => {
                message += `${index + 1}. ${activity.admin} - ${activity.action}\n`;
                message += `   ⏰ ${new Date(activity.timestamp).toLocaleString()}\n`;

                if (activity.details?.messageText) {
                    message += `   💬 ${activity.details.messageText.substring(0, 50)}...\n`;
                }
                message += '\n';
            });
        }

        ctx.reply(message, Markup.inlineKeyboard([
            [Markup.button.callback('📋 Full Activity Log', 'view_full_activities')],
            [Markup.button.callback('⬅️ Back', 'back_to_master_menu')]
        ]));

    } catch (error) {
        console.error('Error viewing activities:', error);
        ctx.reply('🛑 Error retrieving activities.', masterAdminMenu);
        ctx.scene.leave();
    }
});


// --- PROMOTE TO ADMIN SCENE (MASTER ADMIN ONLY) ---
const promoteAdminScene = new Scenes.BaseScene('promote_admin_scene');

promoteAdminScene.enter(async (ctx) => {
  const masterAdminId = String(process.env.MASTER_ADMIN_ID);

  if (String(ctx.from.id) !== masterAdminId) {
    await ctx.reply('🛑 Unauthorized: Only the master admin can promote users to admin.');
    return ctx.scene.leave();
  }

  await ctx.reply(
    '🔑 Please enter the Telegram ID of the user to promote to admin:',
    Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
  );
});

promoteAdminScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim();

  if (input === '🛑 Cancel') {
    await ctx.reply('✅ Promotion process cancelled.', Markup.removeKeyboard());
    await ctx.reply('Master Admin Menu:', masterAdminMenu);
    return ctx.scene.leave();
  }

  const telegramId = input.match(/^\d+$/) ? input : null;
  if (!telegramId) {
    await ctx.reply(
      '🛑 Invalid Telegram ID. Please enter a valid numeric ID or press "Cancel".',
      Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
    );
    return;
  }

  try {
    const user =
      await User.findOne({ telegramId: String(telegramId) }) ||
      await User.findOne({ telegramId: Number(telegramId) });

    if (!user) {
      await ctx.reply(
        '🛑 User not found. Please enter a valid Telegram ID or press "Cancel".',
        Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
      );
      return;
    }

    if (user.role === 'admin' || user.role === 'masterAdmin') {
      await ctx.reply('🛑 This user is already an admin or master admin.', Markup.removeKeyboard());
      await ctx.reply('Master Admin Menu:', masterAdminMenu);
      return ctx.scene.leave();
    }

    await User.updateOne(
      { telegramId: user.telegramId },
      {
        $set: {
          role: 'admin',
          adminId: telegramId,
          updatedAt: new Date(),
        },
      }
    );

    await ctx.reply(
      `✅ User <b>${user.name || 'Unknown'}</b> (${telegramId}) has been promoted to admin.`,
      {
        parse_mode: 'HTML',
        ...Markup.removeKeyboard(),
      }
    );

    await notifyMasterAdmin(ctx, 'user_promoted_to_admin', {
      promotedUser: { telegramId, name: user.name },
      adminId: ctx.from.id,
    });

    try {
      await ctx.telegram.sendMessage(
        telegramId,
        `🎉 Congratulations! You have been promoted to <b>Admin</b> by the Master Admin.`,
        { parse_mode: 'HTML' }
      );
    } catch (notifyError) {
      console.error('Could not notify promoted user:', notifyError);
    }

    await logAdminAction(ctx, 'PROMOTE_ADMIN', {
      promotedUser: user.name || 'Unknown',
      telegramId,
      timestamp: new Date(),
    });

    ctx.scene.leave();
  } catch (error) {
    console.error('Error promoting user to admin:', error);
    await ctx.reply(
      '🛑 An error occurred. Please try again or press "Cancel".',
      Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
    );
    await notifyMasterAdmin(ctx, 'promote_admin_error', {
      error: error.message,
      telegramId,
      adminId: ctx.from.id,
    });
  }
});

promoteAdminScene.on('message', async (ctx) => {
  await ctx.reply(
    '🛑 Please enter a valid Telegram ID (numeric) or press "Cancel".',
    Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
  );
});



stage.register(viewAllAdminsScene);
stage.register(removeAdminScene);
stage.register(adminActivitiesScene);
stage.register(promoteAdminScene);




// Parent Unlink Scene 
const parentUnlinkScene = new Scenes.BaseScene('parent_unlink_scene');

parentUnlinkScene.enter(async (ctx) => {
  try {
    const parent = await User.findOne({ telegramId: ctx.from.id.toString(), role: 'parent' });
    if (!parent) {
      await ctx.reply(
        '🛑 You are not registered as a parent.',
        loginMenu
      );
      return ctx.scene.leave();
    }

    if (!parent.studentIds || parent.studentIds.length === 0) {
      await ctx.reply('🛑 You have no students linked to your account.', loginMenu);
      return ctx.scene.leave();
    }

    const students = await Promise.all(
      parent.studentIds.map(async (studentId) => {
        const student = await Student.findOne({ studentId });
        return student ? { studentId, name: student.name, class: student.class } : null;
      })
    );

    const validStudents = students.filter(s => s);
    if (validStudents.length === 0) {
      await ctx.reply('🛑 No valid students found linked to your account.', loginMenu);
      return ctx.scene.leave();
    }

    const studentButtons = validStudents.map(student => [
      Markup.button.callback(
        `${student.name} (${student.studentId})`,
        `unlink_select_${student.studentId}`
      )
    ]);
    studentButtons.push([Markup.button.callback('🛑 Cancel', 'unlink_cancel')]);

    await ctx.reply(
      '👶 Select a student to unlink from your account:',
      Markup.inlineKeyboard(studentButtons)
    );

  } catch (error) {
    console.error('Error entering parent unlink scene:', error);
    await ctx.reply('🛑 An error occurred while loading linked students. Please try again.', loginMenu);
    ctx.scene.leave();
  }
});

parentUnlinkScene.action(/^unlink_select_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const studentId = ctx.match[1];

  try {
    const student = await Student.findOne({ studentId });
    if (!student) {
      await ctx.reply('🛑 Student not found in the database.', parentMenu);
      return ctx.scene.leave();
    }

    ctx.session.unlinkStudentId = studentId;
    ctx.session.unlinkStudentName = student.name;

    await ctx.reply(
      `⚠️ Are you sure you want to unlink ${student.name} (${studentId}) from your account?`,
      Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm', 'unlink_confirm'),
        Markup.button.callback('🛑 Cancel', 'unlink_cancel')
      ])
    );

  } catch (error) {
    console.error('Error selecting student for unlink:', error);
    await ctx.reply('🛑 An error occurred. Please try again.', parentMenu);
    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();
  }
});

parentUnlinkScene.action('unlink_confirm', async (ctx) => {
  await ctx.answerCbQuery();
  const { unlinkStudentId, unlinkStudentName } = ctx.session;

  if (!unlinkStudentId) {
    await ctx.reply('🛑 No student selected. Please start over.', parentMenu);
    return ctx.scene.leave();
  }

  try {
    const parent = await User.findOne({ telegramId: ctx.from.id.toString(), role: 'parent' });
    if (!parent) {
      await ctx.reply('🛑 Parent profile not found.', parentMenu);
      return ctx.scene.leave();
    }

    if (!parent.studentIds.includes(unlinkStudentId)) {
      await ctx.reply('🛑 This student is not linked to your account.', parentMenu);
      delete ctx.session.unlinkStudentId;
      delete ctx.session.unlinkStudentName;
      return ctx.scene.leave();
    }

    parent.pendingUnlinkStudentIds = parent.pendingUnlinkStudentIds || [];
    if (parent.pendingUnlinkStudentIds.includes(unlinkStudentId)) {
      await ctx.reply(
        `⚠️ An unlink request for ${unlinkStudentName} (${unlinkStudentId}) is already pending.`,
        { reply_markup: parentMenu.reply_markup }
      );
      delete ctx.session.unlinkStudentId;
      delete ctx.session.unlinkStudentName;
      return ctx.scene.leave();
    }

    parent.pendingUnlinkStudentIds.push(unlinkStudentId);
    await parent.save();

    const parentId = ctx.from.id.toString();
    const requestId = `${parentId}_unlink_${unlinkStudentId}`;
    const sentMessages = [];

    const admins = await getAdmins();
    const masterAdmin = await User.findOne({ role: 'master_admin' });
    const masterAdminId = masterAdmin ? masterAdmin.telegramId : null;

    for (const admin of admins) {
      if (admin.role !== 'master_admin' && admin.telegramId !== parentId) {
        try {
          const msg = await ctx.telegram.sendMessage(
            admin.telegramId,
            `🛑 <b>Parent Unlink Request</b>\n\n` +
            `👤 Parent: <b>${parent.name}</b> (@${parent.username || 'N/A'})\n` +
            `🆔 Telegram ID: <b>${parent.telegramId}</b>\n` +
            `👶 Student: <b>${unlinkStudentName}</b> (${unlinkStudentId})\n` +
            `📅 Timestamp: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`,
            {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ Approve', `approve_unlink:${parentId}:${unlinkStudentId}`),
                  Markup.button.callback('🛑 Deny', `deny_unlink:${parentId}:${unlinkStudentId}`)
                ]
              ])
            }
          );
          sentMessages.push({ adminId: admin.telegramId, messageId: msg.message_id });
        } catch (error) {
          console.error(`Failed to notify admin ${admin.telegramId}:`, error);
        }
      }
    }

    if (sentMessages.length > 0) {
      await ApprovalMessage.create({
        type: 'unlink_parent',
        requestId,
        messages: sentMessages,
        createdAt: new Date()
      });
    }

    await ctx.reply(
      `✅ Unlink request for ${unlinkStudentName} (${unlinkStudentId}) submitted. Awaiting admin approval.`,
      { reply_markup: parentMenu.reply_markup }
    );

    setTimeout(async () => {
      try {
        const approval = await ApprovalMessage.findOne({ type: 'unlink_parent', requestId });
        if (!approval) return;

        const freshParent = await User.findOne({ telegramId: parentId });
        if (freshParent && freshParent.pendingUnlinkStudentIds.includes(unlinkStudentId)) {
          freshParent.pendingUnlinkStudentIds = freshParent.pendingUnlinkStudentIds.filter(id => id !== unlinkStudentId);
          await freshParent.save();
          await ApprovalMessage.deleteOne({ _id: approval._id });

          const expiredText =
            `⌛ <b>Unlink Request Expired</b>\n\n` +
            `👤 Parent: <b>${parent.name}</b> (ID: ${parentId})\n` +
            `👶 Student: <b>${unlinkStudentName}</b> (${unlinkStudentId})\n` +
            `📅 Date: ${approval.createdAt.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}\n\n` +
            `⚠️ No action was taken within 5 minutes. The request has been cancelled.`;

          if (masterAdminId) {
            await ctx.telegram.sendMessage(masterAdminId, expiredText, { parse_mode: 'HTML' });
          }
          for (const admin of admins) {
            await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          await ctx.telegram.sendMessage(
            parentId,
            `⚠️ Your unlink request for ${unlinkStudentName} (${unlinkStudentId}) expired after 5 minutes. Please try again.`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (err) {
        console.error('Error auto-clearing expired unlink:', err);
      }
    }, 5 * 60 * 1000);

    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();

  } catch (error) {
    console.error('Error submitting unlink request:', error);
    await ctx.reply('🛑 An error occurred while submitting the unlink request. Please try again.', loginMenu);
    delete ctx.session.unlinkStudentId;
    delete ctx.session.unlinkStudentName;
    ctx.scene.leave();
  }
});

parentUnlinkScene.action('unlink_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 Unlink operation cancelled.', { reply_markup: parentMenu.reply_markup });
  delete ctx.session.unlinkStudentId;
  delete ctx.session.unlinkStudentName;
  ctx.scene.leave();
});

stage.register(parentUnlinkScene);



// --- TEACHER FORGOT PASSWORD SCENE ---
const teacherForgotPasswordScene = new Scenes.BaseScene('teacher_forgot_password_scene');

teacherForgotPasswordScene.enter((ctx) => {
    ctx.reply(
        '❓ Forgot Password\n\n' +
        'Do you want to request an OTP for password reset?\n\n' +
        'Type YES to continue or NO to cancel.'
    );
});

teacherForgotPasswordScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim().toUpperCase();

    if (ctx.session.awaitingResetOTP) {
        if (!/^\d{6}$/.test(text)) {
            return ctx.reply('🛑 Please enter a valid 6-digit OTP.');
        }

        const otpRecord = await OTP.findOne({ telegramId: String(ctx.from.id) });
        if (!otpRecord || isOTPExpired(otpRecord.expiresAt)) {
            ctx.reply('🛑 OTP expired or not found. Please try again.');
            await OTP.deleteOne({ telegramId: String(ctx.from.id) });
            delete ctx.session.awaitingResetOTP;
            return ctx.scene.leave();
        }

        if (text !== otpRecord.otp) {
            return ctx.reply('🛑 Incorrect OTP. Try again.');
        }

        try {
            const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
            if (!teacher) {
                ctx.reply('🛑 Teacher profile not found.');
                return ctx.scene.leave();
            }

            const newPassword = generatePassword();
            const hashedPassword = hashPassword(newPassword);

            await TeacherLogin.updateOne(
                { teacherId: teacher.teacherId },
                { 
                    $set: { 
                        password: hashedPassword,
                        loginAttempts: 0,
                        lockedUntil: null
                    } 
                }
            );

            await OTP.deleteOne({ telegramId: String(ctx.from.id) });

            ctx.replyWithHTML(
                `✅ Password Reset Successful!\n\n` +
                `👤 Name: ${teacher.name}\n` +
                `🆔 Teacher ID: <code>${teacher.teacherId}</code>\n` +
                `🔐 New Password: <code>${newPassword}</code>\n\n` +
                `_Please save your new password securely._`,
                postLogoutMenu
            );

        } catch (err) {
            console.error('Error resetting password:', err);
            ctx.reply('🛑 Failed to reset password.');
        } finally {
            delete ctx.session.awaitingResetOTP;
            ctx.scene.leave();
        }

        return;
    }

    if (text === 'NO' || text === 'CANCEL') {
        ctx.reply('🛑 Password reset cancelled.', postLogoutMenu);
        return ctx.scene.leave();
    }

    if (text === 'YES') {
        try {
            const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
            if (!teacher) {
                ctx.reply('🛑 You are not registered as a teacher. Please register first or contact admin.', loginMenu);
                return ctx.scene.leave();
            }

            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await OTP.deleteOne({ telegramId: String(ctx.from.id) }); // clear old
            await new OTP({
                telegramId: String(ctx.from.id),
                otp,
                expiresAt
            }).save();

            const admins = await getAdmins();
            for (const admin of admins) {
                try {
                    await ctx.telegram.sendMessage(
                        admin.telegramId,
                        `🔑 Password Reset Request:\n\n` +
                        `👤 Teacher: ${teacher.name}\n` +
                        `🆔 Teacher ID: ${teacher.teacherId}\n` +
                        `📱 Telegram ID: ${ctx.from.id}\n\n` +
                        `⏰ Expires: ${expiresAt.toLocaleTimeString()}\n\n` +
                        `Click below to view OTP securely:`,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('🔑 View OTP', `view_reset_otp_${teacher.telegramId}`)]
                        ])
                    );
                } catch (err) {
                    console.error(`Failed to notify admin ${admin.telegramId}:`, err);
                }
            }

            ctx.reply('📧 OTP has been sent to administrators. Please enter the 6-digit OTP code:');
            ctx.session.awaitingResetOTP = true;

        } catch (error) {
            console.error('Error requesting password reset:', error);
            ctx.reply('🛑 Failed to request password reset.');
            ctx.scene.leave();
        }

        return;
    }

    return ctx.reply('🛑 Please type YES to continue or NO to cancel.');
});

bot.action(/^view_reset_otp_(\d+)$/, async (ctx) => {
    try {
        const teacherId = ctx.match[1].toString();
        const otpRecord = await OTP.findOne({ telegramId: String(teacherId) });
        if (!otpRecord || isOTPExpired(otpRecord.expiresAt)) {
            return ctx.answerCbQuery('🛑 OTP not found or expired');
        }

        await ctx.reply(
            `🔑 OTP for Teacher ID ${teacherId}:\n\n` +
            `<code>${otpRecord.otp}</code>\n\n` +
            `⏰ Expires at: ${new Date(otpRecord.expiresAt).toLocaleTimeString()}`,
            { parse_mode: "HTML" }
        );

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
            await ctx.telegram.sendMessage(
                master.telegramId,
                `⚠️ Admin <b>${ctx.from.first_name || 'Unknown'}</b> (@${ctx.from.username || 'N/A'}) ` +
                `viewed the <b>Password Reset OTP</b> for teacher <code>${teacherId}</code>.`,
                { parse_mode: "HTML" }
            );
        }

        await logAdminAction(ctx, 'VIEW_RESET_OTP', {
            viewedBy: ctx.from.id,
            teacherId,
            otp: otpRecord.otp
        });

        await ctx.answerCbQuery('✅ OTP shown to you');
    } catch (error) {
        console.error('Error showing OTP to admin:', error);
        ctx.answerCbQuery('🛑 Error showing OTP');
    }
});


stage.register(teacherForgotPasswordScene);



const requestStudentsListScene = new Scenes.BaseScene('request_students_list_scene');

requestStudentsListScene.enter(async (ctx) => {
  try {
    const classes = await getUniqueClasses();
    if (classes.length === 0) {
      ctx.reply('🛑 No classes available.');
      return ctx.scene.leave();
    }
    const buttons = classes.map(cls => [Markup.button.callback(cls, `select_class_${cls.replace(/ /g, '_')}`)]);
    buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_request_students_list')]);
    await ctx.reply('📚 Select the class for which you want to request the student list:', Markup.inlineKeyboard(buttons));
  } catch (error) {
    console.error('Error fetching classes:', error);
    ctx.reply('🛑 Could not fetch classes. Try again later.');
    ctx.scene.leave();
  }
});

requestStudentsListScene.action(/^select_class_(.+)$/, async (ctx) => {
  const className = ctx.match[1].replace(/_/g, ' ');
  ctx.session.requestClass = className;

  const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
  const currentSubjects = teacher.subjects || [];
  if (currentSubjects.length === 0) {
    await ctx.reply('🛑 You have no subjects assigned.');
    return ctx.scene.leave();
  }

  const subjectButtons = currentSubjects.map(subject => [Markup.button.callback(subject, `select_subject_${subject.replace(/ /g, '_')}`)]);
  subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_request_students_list')]);

  await ctx.reply(`📖 You selected class "${className}". Now select the subject:`, Markup.inlineKeyboard(subjectButtons));
});

requestStudentsListScene.action(/^select_subject_(.+)$/, async (ctx) => {
  const subject = ctx.match[1].replace(/_/g, ' ');
  ctx.session.requestSubject = subject;

  await ctx.reply(`✅ Confirm your request:\n\nClass: ${ctx.session.requestClass}\nSubject: ${subject}\n\nType CONFIRM to proceed or CANCEL to abort.`, { parse_mode: "HTML" });
  ctx.session.awaitingConfirmation = true;
});

requestStudentsListScene.on('text', async (ctx) => {
  if (!ctx.session.awaitingConfirmation) {
    return ctx.reply('🛑 Please select a class and subject first.');
  }

  const input = ctx.message.text.trim().toUpperCase();
  if (input === 'CANCEL' || input === '🛑 CANCEL') {
    await ctx.reply('🛑 Request cancelled.', teacherMenu);
    return ctx.scene.leave();
  }
  if (input !== 'CONFIRM') {
    return ctx.reply('🛑 Please type CONFIRM to submit or CANCEL to abort.');
  }

  try {
    
    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (!teacher) {
      ctx.reply('🛑 Teacher profile not found.');
      return ctx.scene.leave();
    }

    const newRequest = new StudentListRequest({
      teacherId: teacher.teacherId,
      teacherTelegramId: ctx.from.id,
      className: ctx.session.requestClass,
      subject: ctx.session.requestSubject,
    });

    await newRequest.save();

    const admins = await User.find({ role: 'admin' });

const message = 
  `📋 Student List Request\n\n` +
  `👨‍🏫 Teacher: ${teacher.name} (${teacher.teacherId})\n` +
  `🏫 Class: ${ctx.session.requestClass}\n` +
  `📚 Subject: ${ctx.session.requestSubject}\n\n` +
  `Use the buttons below to approve or deny.`;

const keyboard = [
  [
    Markup.button.callback('✅ Approve', `approve_request_${newRequest._id}`),
    Markup.button.callback('🛑 Deny', `deny_request_${newRequest._id}`)
  ]
];

await broadcastWithTracking(
  'student_list',              // Approval type
  newRequest._id.toString(),   // Request ID — used later for cleanup
  admins,                      // List of admin users
  message,
  keyboard
);

ctx.reply('✅ Your request has been sent for admin approval.', teacherMenu);
ctx.scene.leave();

  } catch (err) {
    console.error('Error saving request:', err);
    ctx.reply('🛑 Failed to submit request.');
    ctx.scene.leave();
  }
});

requestStudentsListScene.action('cancel_request_students_list', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🛑 Request cancelled.', teacherMenu);
  ctx.scene.leave();
});
stage.register(requestStudentsListScene);

// Teacher Registration Start Scene 


const teacherRegisterStartScene = new Scenes.BaseScene('teacher_register_start_scene');

teacherRegisterStartScene.enter(async (ctx) => {
    try {
        const existingTeacher = await Teacher.findOne({ teacherId: ctx.from.id });
        if (existingTeacher) {
            const message = `✅ You are already registered as a teacher!\n\n` +
                           `👤 Name: ${existingTeacher.name}\n` +
                           `🆔 Teacher ID: ${existingTeacher.teacherId}\n\n` +
                           `Use the "🔐 Teacher Login" option to access your account.`;
            ctx.reply(message, teacherMenu);
            return ctx.scene.leave();
        }
        
        const user = await getUserById(ctx.from.id);
        if (user && user.role === 'teacher') {
            ctx.reply('✅ You are already registered as a teacher! Use the "🔐 Teacher Login" option.', postLogoutMenu);
            return ctx.scene.leave();
        }

        const existingOTP = await OTP.findOne({ telegramId: ctx.from.id });
        if (existingOTP && !isOTPExpired(existingOTP.expiresAt) && !existingOTP.verified) {
            ctx.reply('📧 You already have a pending registration. Please check your messages for the OTP.');
            return ctx.scene.leave();
        }

        ctx.reply(
            '🏫 Teacher Registration\n\n' +
            'Please enter your Registration code to continue:',
            Markup.keyboard([['🛑 Cancel Registration']]).resize()
        );
        ctx.session.awaitingSchoolCode = true;

    } catch (error) {
        console.error('Error in teacher registration start:', error);
        ctx.reply('🛑 An error occurred while starting registration. Please try again.');
        ctx.scene.leave();
    }
});

teacherRegisterStartScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    if (text === '🛑 Cancel Registration') {
        await OTP.deleteOne({ telegramId: ctx.from.id });
        ctx.reply('🛑 Registration cancelled.', Markup.removeKeyboard());
        return ctx.scene.leave();
    }

    if (ctx.session.awaitingSchoolCode) {
        const schoolCode = process.env.TEACHER_REG_CODE;
        
        if (!schoolCode) {
            ctx.reply('🛑 School verification system is not configured. Please contact administration.');
            return ctx.scene.leave();
        }

        if (text !== schoolCode) {
            ctx.reply('🛑 Invalid Registration code. Please try again or contact your school administration.');
            return;
        }

        ctx.session.awaitingSchoolCode = false;
        
        try {
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration

            await OTP.deleteOne({ telegramId: ctx.from.id });

            const newOTP = new OTP({
                telegramId: ctx.from.id.toString(),
                otp: otp,
                expiresAt: expiresAt,
                code: otp
            });
            await newOTP.save();

            const admins = await getAdmins();
            let notifiedAdmins = 0;

            for (const admin of admins) {
                try {
                    await ctx.telegram.sendMessage(
                        admin.telegramId,
                        `🔐 New Teacher Registration Request:\n\n` +
                        `👤 Telegram User: ${ctx.from.first_name || 'Unknown'} ${ctx.from.last_name || ''}\n` +
                        `📱 Username: @${ctx.from.username || 'N/A'}\n` +
                        `🆔 Telegram ID: ${ctx.from.id}\n` +
                        `✅ Registration Code Verified: Yes\n\n` +
                        `⏰ Expires: ${expiresAt.toLocaleTimeString()}\n\n` +
                        `Click below to view the OTP securely:`,
                        Markup.inlineKeyboard([
                            [Markup.button.callback('🔑 View OTP', `view_teacher_otp_${ctx.from.id}`)]
                        ])
                    );
                    notifiedAdmins++;
                } catch (error) {
                    console.error(`Failed to notify admin ${admin.telegramId}:`, error);
                }
            }

            if (notifiedAdmins > 0) {
                ctx.reply(
                    '✅ Registration code verified!\n\n' +
                    '📧 A verification code has been sent to administrators.\n\n' +
                    'Please wait for an admin to provide you with the 6-digit verification code, then enter it below:',
                    Markup.keyboard([['🛑 Cancel Registration']]).resize()
                );
            } else {
                ctx.reply('🛑 No administrators are available to process your registration. Please try again later.');
                await OTP.deleteOne({ telegramId: ctx.from.id });
                ctx.scene.leave();
            }
        } catch (error) {
            console.error('Error generating OTP:', error);
            ctx.reply('🛑 An error occurred during registration. Please try again.');
            ctx.scene.leave();
        }
        return;
    }

    if (!/^\d{6}$/.test(text)) {
        ctx.reply('🛑 Please enter a valid 6-digit verification code.');
        return;
    }

    const otpRecord = await OTP.findOne({ telegramId: String(ctx.from.id) });
    
    if (!otpRecord) {
        ctx.reply('🛑 No registration request found. Please start over.');
        return ctx.scene.leave();
    }

    if (isOTPExpired(otpRecord.expiresAt)) {
        ctx.reply('🛑 Verification code has expired. Please start registration again.');
        await OTP.deleteOne({ telegramId: ctx.from.id });
        return ctx.scene.leave();
    }

    if (otpRecord.attempts >= 3) {
        ctx.reply('🛑 Too many failed attempts. Please start registration again.');
        await OTP.deleteOne({ telegramId: ctx.from.id });
        return ctx.scene.leave();
    }

    if (text !== otpRecord.otp) {
        otpRecord.attempts += 1;
        await otpRecord.save();
        
        const remainingAttempts = 3 - otpRecord.attempts;
        ctx.reply(`🛑 Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
        return;
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const existingTeacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (existingTeacher) {
        const message = `✅ You are already registered as a teacher!\n\n` +
                       `👤 Name: ${existingTeacher.name}\n` +
                       `🆔 Teacher ID: ${existingTeacher.teacherId}\n\n` +
                       `Use the "🔐 Teacher Login" option to access your account.`;
        ctx.reply(message, teacherMenu);
        
        await OTP.deleteOne({ telegramId: ctx.from.id });
        
        return ctx.scene.leave();
    }
 
    ctx.reply('✅ Verification successful! Please enter your full name:');
    ctx.scene.enter('teacher_register_name_scene');
});

teacherRegisterStartScene.action('cancel_registration', async (ctx) => {
    await ctx.answerCbQuery();
    await OTP.deleteOne({ telegramId: ctx.from.id });
    delete ctx.session.awaitingSchoolCode;
    ctx.reply('🛑 Registration cancelled.', Markup.removeKeyboard());
    ctx.scene.leave();
});

bot.action(/^view_teacher_otp_(\d+)$/, async (ctx) => {
    try {
        const teacherId = ctx.match[1];
        const otpRecord = await OTP.findOne({ telegramId: String(teacherId) });
        if (!otpRecord) {
            return ctx.answerCbQuery('🛑 OTP not found or expired');
        }

        await ctx.reply(
            `🔑 OTP for Teacher ID ${teacherId}:\n\n` +
            `<code>${otpRecord.otp}</code>\n\n` +
            `⏰ Expires at: ${new Date(otpRecord.expiresAt).toLocaleTimeString()}`,
            { parse_mode: "HTML" }
        );

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
            await ctx.telegram.sendMessage(
                master.telegramId,
                `⚠️ Admin <b>${ctx.from.first_name || 'Unknown'}</b> (@${ctx.from.username || 'N/A'}) ` +
                `viewed the OTP for teacher  Telegram ID <code>${teacherId}</code>.`,
                { parse_mode: "HTML" }
            );
        }

        await logAdminAction(ctx, 'VIEW_TEACHER_OTP', {
            viewedBy: ctx.from.id,
            teacherId: teacherId,
            otp: otpRecord.otp
        });

        await ctx.answerCbQuery('✅ OTP shown to you');
    } catch (error) {
        console.error('Error showing OTP to admin:', error);
        ctx.answerCbQuery('🛑 Error showing OTP');
    }
});

stage.register(teacherRegisterStartScene);

const teacherRegisterNameScene = new Scenes.BaseScene('teacher_register_name_scene');

teacherRegisterNameScene.enter(async (ctx) => {
    const existingTeacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (existingTeacher) {
        ctx.reply('✅ You are already registered as a teacher!', teacherMenu);
        return ctx.scene.leave();
    }
    
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        ctx.reply('✅ You are already registered as a teacher!', teacherMenu);
        return ctx.scene.leave();
    }
    
    ctx.reply('👤 Please enter your full name:');
});
teacherRegisterNameScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    
    if (ctx.session.waitingForConfirmation) {
        if (text === 'CONFIRM') {
            const name = ctx.session.teacherName;
            const password = ctx.session.tempPassword;
            
            try {
                const existingTeacher = await Teacher.findOne({ telegramId: ctx.from.id });
                if (existingTeacher) {
                    ctx.reply('✅ You are already registered as a teacher!', teacherMenu);
                    
                    await OTP.deleteOne({ telegramId: ctx.from.id });
                    
                    delete ctx.session.teacherName;
                    delete ctx.session.tempPassword;
                    delete ctx.session.waitingForConfirmation;
                    
                    return ctx.scene.leave();
                }
                
                const teacherId = await generateUniqueTeacherId();
                
                const newTeacher = new Teacher({
                    teacherId: teacherId,
                    name: name,
                    telegramId: ctx.from.id,
                    subjects: [],
                    pendingSubjects: []
                });
                await newTeacher.save();
                
                const hashedPassword = hashPassword(password);
                const teacherLogin = new TeacherLogin({
                    teacherId: teacherId,
                    password: hashedPassword
                });
                await teacherLogin.save();
                
                let user = await getUserById(ctx.from.id);
                if (user) {
                    user.role = 'teacher';
                    user.name = name;
                    await user.save();
                } else {
                    user = new User({
                        telegramId: ctx.from.id,
                        username: ctx.from.username || '',
                        name: name,
                        role: 'teacher'
                    });
                    await user.save();
                }
                
                await OTP.deleteOne({ telegramId: ctx.from.id });
                
                delete ctx.session.teacherName;
                delete ctx.session.tempPassword;
                delete ctx.session.waitingForConfirmation;
                
                ctx.replyWithHTML(
                    `✅ Registration Successful!\n\n` +
                    `👤 Name: ${name}\n` +
                    `🆔 Teacher ID: <code>${teacherId}</code>\n` +
                    `🔐 Password: <code>${password}</code>\n\n` +
                    `_Please save your Teacher ID and Password in a secure place._`,
                    await getLoginMenu(ctx.from.id)
                );


const admins = await getAdmins();
for (const admin of admins) {
    try {
        await ctx.telegram.sendMessage(
            admin.telegramId,
            `📢 <b>New Teacher Registered!</b>\n\n` +
            `👤 Name: ${name}\n` +
            `🆔 Teacher ID: <code>${teacherId}</code>\n`,
                        { parse_mode: "HTML" }
        );
    } catch (err) {
        console.error(`Failed to notify admin ${admin.telegramId}:`, err);
    }
}

                
            } catch (error) {
                if (error.code === 11000) {
                    ctx.reply('✅ You are already registered as a teacher!', teacherMenu);
                } else {
                    console.error('Error completing teacher registration:', error);
                    ctx.reply('🛑 An error occurred during registration. Please try again.');
                }
                
                await OTP.deleteOne({ telegramId: ctx.from.id });
                delete ctx.session.teacherName;
                delete ctx.session.tempPassword;
                delete ctx.session.waitingForConfirmation;
            }
            
            ctx.scene.leave();
            return;
        } 
        else if (text === 'CANCEL') {
            await OTP.deleteOne({ telegramId: ctx.from.id });
            delete ctx.session.teacherName;
            delete ctx.session.tempPassword;
            delete ctx.session.waitingForConfirmation;
            
            ctx.reply('🛑 Registration cancelled.', Markup.removeKeyboard());
            ctx.scene.leave();
            return;
        }
        else {
            ctx.reply('Please type "CONFIRM" to complete registration or "CANCEL" to abort:');
            return;
        }
    }
    
    if (!isValidName(text)) {
        ctx.reply('🛑 Invalid name. Please enter a valid name (1-100 characters).');
        return;
    }

    ctx.session.teacherName = text;
    
    const password = generatePassword();
    ctx.session.tempPassword = password;
    ctx.session.waitingForConfirmation = true;
    
    ctx.reply(
        `🔐 Your auto-generated password is: ${password}\n\n` +
        'Please save this password securely. You will need it to log in.\n\n' +
        'Type "CONFIRM" to complete registration or "CANCEL" to abort:',
        Markup.keyboard([['CONFIRM'], ['CANCEL']]).resize()
    );
});

stage.register(teacherRegisterNameScene);
stage.register(teacherRegisterStartScene);

// Teacher Login Scene
        
const teacherLoginScene = new Scenes.BaseScene('teacher_login_scene');

teacherLoginScene.enter((ctx) => {
    ctx.reply(
        '🔐 Teacher Login\n\n' +
        'Please enter your Teacher ID:',
        Markup.keyboard([['🛑 Cancel Login']]).resize()
    );
});

teacherLoginScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    
    if (text === '🛑 Cancel Login') {
        ctx.reply('🛑 Login cancelled.',  postLogoutMenu);
        return ctx.scene.leave();
    }
    
    if (!ctx.session.loginState) {
        if (!isValidTeacherId(text)) {
            ctx.reply('🛑 Invalid Teacher ID format. Please enter a valid Teacher ID (e.g., TE1234).');
            return;
        }
        
        const teacher = await Teacher.findOne({ teacherId: text });
        if (!teacher) {
            ctx.reply('🛑 Teacher ID not found. Please check and try again.');
            return;
        }
        
        ctx.session.loginState = 'password';
        ctx.session.loginTeacherId = text;
        ctx.reply('Please enter your password:');
    } else if (ctx.session.loginState === 'password') {
        const teacherId = ctx.session.loginTeacherId;
        const password = text;
        
        const teacherLogin = await TeacherLogin.findOne({ teacherId });
        if (!teacherLogin) {
            ctx.reply('🛑 Login credentials not found. Please contact an administrator.');
            delete ctx.session.loginState;
            delete ctx.session.loginTeacherId;
            return ctx.scene.leave();
        }
        
        if (isAccountLocked(teacherLogin.lockedUntil)) {
            const lockTime = Math.ceil((teacherLogin.lockedUntil - new Date()) / 60000); // minutes
            ctx.reply(`🛑 Account temporarily locked. Try again in ${lockTime} minutes.`);
            delete ctx.session.loginState;
            delete ctx.session.loginTeacherId;
            return ctx.scene.leave();
        }
teacherLoginScene.action('cancel_login', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Login cancelled.',  postLogoutMenu);
    ctx.scene.leave();
});

teacherLoginScene.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    
    if (text === '🛑 Cancel Login') {
        ctx.reply('🛑 Login cancelled.',  postLogoutMenu);
        return ctx.scene.leave();
    }
    
});
        if (!verifyPassword(password, teacherLogin.password)) {
            teacherLogin.loginAttempts += 1;
            
            if (teacherLogin.loginAttempts >= 5) {
                teacherLogin.lockedUntil = new Date(Date.now() + 3 * 60 * 1000);
                teacherLogin.loginAttempts = 0;
                await teacherLogin.save();
                
                ctx.reply('🛑 Too many failed attempts. Account locked for 15 minutes.');
            } else {
                const remainingAttempts = 5 - teacherLogin.loginAttempts;
                await teacherLogin.save();
                ctx.reply(`🛑 Incorrect password. ${remainingAttempts} attempt(s) remaining.`);
            }
            
            return;
        }
        
        teacherLogin.loginAttempts = 0;
        teacherLogin.lockedUntil = null;
        teacherLogin.lastLogin = new Date();
        await teacherLogin.save();
        


        const teacher = await Teacher.findOne({ teacherId });
        if (teacher) {
            // Update telegramId if it's different or missing
            if (teacher.telegramId !== ctx.from.id) {
                teacher.telegramId = ctx.from.id;
                await teacher.save();
            }
            
            let user = await getUserById(ctx.from.id);
            if (user) {
                user.role = 'teacher';
                user.name = teacher.name; 
                if (teacher.subjects) {
                    user.subjects = teacher.subjects;
                }
                await user.save();
            } else {
                user = new User({
                    telegramId: ctx.from.id,
                    username: ctx.from.username || '',
                    name: teacher.name,
                    role: 'teacher',
                    subjects: teacher.subjects || []
                });
                await user.save();
            }
        }
        
        delete ctx.session.loginState;
        delete ctx.session.loginTeacherId;
        
        ctx.reply('✅ Login successful!', teacherMenu);
        ctx.scene.leave();
    }


});

stage.register(teacherLoginScene);

// --- Teacher Contact Admin Scene ---
const teacherContactAdminScene = new Scenes.BaseScene('teacher_contact_admin_scene');

teacherContactAdminScene.enter(async (ctx) => {
    try {
        const admins = await getAdmins();
        
        if (admins.length === 0) {
            ctx.reply('🛑 No admins found to contact.', teacherMenu);
            return ctx.scene.leave();
        }

        const adminButtons = admins.map(admin => [
            Markup.button.callback(
                `${admin.name} (ID: ${admin.telegramId})`,
                `select_admin_${admin.telegramId}`
            )
        ]);
        
        adminButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_contact_admin')]);

        ctx.reply('👑 Select an admin to contact:', Markup.inlineKeyboard(adminButtons));

    } catch (error) {
        console.error('Error in teacher contact admin scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherContactAdminScene.action(/^select_admin_(\d+)$/, async (ctx) => {
    const adminId = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const admin = await User.findOne({ telegramId: ctx.from.id });
        if (!admin) {
            ctx.reply('🛑 Admin not found.', teacherMenu);
            return ctx.scene.leave();
        }
        
        ctx.session.contactAdminInfo = {
            adminId: adminId,
            adminName: admin.name
        };

        ctx.reply(
            `📬 You are now messaging ${admin.name}.\n\n` +
            `Please send your message (text, photo, video, document, audio, or voice):`,
            Markup.keyboard([['🛑 Cancel']]).resize()
        );

    } catch (error) {
        console.error('Error selecting admin:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherContactAdminScene.action('cancel_contact_admin', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Contact admin cancelled.', teacherMenu);
    ctx.scene.leave();
});

teacherContactAdminScene.hears('🛑 Cancel', async (ctx) => {
    ctx.reply('🛑 Contact admin cancelled.', teacherMenu);
    ctx.scene.leave();
});
teacherContactAdminScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
    const contactInfo = ctx.session.contactAdminInfo;
    
    if (!contactInfo) {
        ctx.reply('🛑 No admin selected. Please start over.', teacherMenu);
        return ctx.scene.leave();
    }

    const { adminId, adminName } = contactInfo;

    let success = false;
    let errorMessage = '';

    try {
        const teacherInfoRich = await getRichTeacherInfo(ctx.from.id);
        if (!teacherInfoRich) {
            ctx.reply('🛑 Could not retrieve your teacher information.', teacherMenu);
            delete ctx.session.contactAdminInfo;
            return ctx.scene.leave();
        }

        const teacherInfo = `
🧑‍🏫 Teacher Contact Request:
━━━━━━━━━━━━━━━━━━━━
• 👤 Name: ${teacherInfoRich.name}
• 🆔 Teacher ID: <code>${teacherInfoRich.teacherId}</code>
• 📞 Telegram ID: ${teacherInfoRich.telegramId}
${teacherInfoRich.username ? `• 👤 Username: @${teacherInfoRich.username}\n` : ''}

📚 Teaching Subjects:
${teacherInfoRich.subjects.map(subj => `  • ${subj}`).join('\n') || '  • No subjects assigned'}

📊 Statistics:
• 👥 Total Students: ${teacherInfoRich.studentCount}
• 🏆 Top Subject: ${teacherInfoRich.subjectStats[0]?._id || 'N/A'} (${teacherInfoRich.subjectStats[0]?.studentCount || 0} students)

📅 Registered: ${new Date(teacherInfoRich.registrationDate).toLocaleDateString()}
━━━━━━━━━━━━━━━━━━━━

💬 Message from Teacher:
`;

        if (ctx.message.text) {
            await ctx.telegram.sendMessage(
                adminId,
                teacherInfo + ctx.message.text,
                { parse_mode: "HTML" }
            );
            success = true;
        } 
        else if (ctx.message.photo) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const caption = ctx.message.caption 
                ? teacherInfo + ctx.message.caption
                : teacherInfo + '📸 Photo message';
            
            await ctx.telegram.sendPhoto(
                adminId,
                photo.file_id,
                { caption, parse_mode: "HTML" }
            );
            success = true;
        }
        else if (ctx.message.video) {
            const caption = ctx.message.caption 
                ? teacherInfo + ctx.message.caption
                : teacherInfo + '🎥 Video message';
            
            await ctx.telegram.sendVideo(
                adminId,
                ctx.message.video.file_id,
                { caption, parse_mode: "HTML" }
            );
            success = true;
        }
        else if (ctx.message.document) {
            const caption = ctx.message.caption 
                ? teacherInfo + ctx.message.caption
                : teacherInfo + '📄 Document message';
            
            await ctx.telegram.sendDocument(
                adminId,
                ctx.message.document.file_id,
                { caption, parse_mode: "HTML" }
            );
            success = true;
        }
        else if (ctx.message.audio) {
            const caption = ctx.message.caption 
                ? teacherInfo + ctx.message.caption
                : teacherInfo + '🎵 Audio message';
            
            await ctx.telegram.sendAudio(
                adminId,
                ctx.message.audio.file_id,
                { caption, parse_mode: "HTML" }
            );
            success = true;
        }
        else if (ctx.message.voice) {
            await ctx.telegram.sendVoice(
                adminId,
                ctx.message.voice.file_id
            );
            await ctx.telegram.sendMessage(
                adminId,
                teacherInfo + '🗣️ Voice message from teacher',
                { parse_mode: "HTML" }
            );
            success = true;
        }

        if (success) {
            ctx.replyWithHTML(
                `✅ Message delivered to ${adminName}!\n\n` +
                `👑 Admin: ${adminName}\n` +
                `📧 Status: ✅ Delivered\n` +
                `⏰ Time: ${new Date().toLocaleTimeString()}\n\n` +
                `The admin can see your full teacher information below your message.`,
                teacherMenu
            );
        }

    } catch (error) {
        if (error.response?.error_code === 403) {
            errorMessage = '🛑 Failed to send message. The admin may have blocked the bot.';
        } else {
            console.error('Error sending message to admin:', error);
            errorMessage = '🛑 Failed to send message. Please try again later.';
        }
        ctx.reply(errorMessage, teacherMenu);
    } finally {
        delete ctx.session.contactAdminInfo;
        ctx.scene.leave();
    }
});
stage.register(teacherContactAdminScene);


// Teacher Export Grades Scene
const teacherExportGradesScene = new Scenes.BaseScene('teacher_export_grades_scene');

teacherExportGradesScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher) {
            ctx.reply('🛑 Teacher profile not found.', teacherMenu);
            return ctx.scene.leave();
        }

        const classes = await getTeacherClasses(teacher.teacherId);
        
        if (classes.length === 0) {
            ctx.reply('🛑 You have no classes assigned.', teacherMenu);
            return ctx.scene.leave();
        }

        const classButtons = classes.map(className => 
            [Markup.button.callback(className, `export_class_${className.replace(/ /g, '_')}`)]
        );
        
        classButtons.push([Markup.button.callback('🛑 Cancel Export', 'cancel_export_grades')]);

        ctx.reply('🏫 Select a class to export grades from:', Markup.inlineKeyboard(classButtons));

    } catch (error) {
        console.error('Error in export grades scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherExportGradesScene.action(/^export_class_(.+)$/, async (ctx) => {
    const className = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const subjects = await getTeacherSubjects(teacher.teacherId, className);
        
        if (subjects.length === 0) {
            ctx.reply(`🛑 No subjects found for class ${className}.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.exportClass = className;

        const subjectButtons = subjects.map(subject => 
            [Markup.button.callback(subject, `export_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('⬅️ Back to Classes', 'export_back_to_classes')]);
        subjectButtons.push([Markup.button.callback('🛑 Cancel Export', 'cancel_export_grades')]);

        ctx.reply(`📚 Select a subject from class ${className}:`, Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        console.error('Error selecting class:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherExportGradesScene.action('export_back_to_classes', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.exportClass;
    ctx.scene.reenter();
});

teacherExportGradesScene.action(/^export_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    ctx.session.exportSubject = subject;
    ctx.reply(
        `📊 Select export format for ${subject} (Class: ${ctx.session.exportClass}):`,
        Markup.inlineKeyboard([
            [Markup.button.callback('📝 Text Report', `export_format_text`)],
            [Markup.button.callback('📊 CSV Format', `export_format_csv`)],
            [Markup.button.callback('⬅️ Back to Subjects', 'export_back_to_subjects')],
            [Markup.button.callback('🛑 Cancel', 'cancel_export_grades')]
        ])
    );
});

teacherExportGradesScene.action('export_back_to_subjects', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.exportSubject;
    const className = ctx.session.exportClass;
    
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const subjects = await getTeacherSubjects(teacher.teacherId, className);
        
        const subjectButtons = subjects.map(subject => 
            [Markup.button.callback(subject, `export_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('⬅️ Back to Classes', 'export_back_to_classes')]);
        subjectButtons.push([Markup.button.callback('🛑 Cancel Export', 'cancel_export_grades')]);

        ctx.editMessageText(
            `📚 Select a subject from class ${className}:`,
            Markup.inlineKeyboard(subjectButtons)
        );

    } catch (error) {
        console.error('Error going back to subjects:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherExportGradesScene.action(/^export_format_(text|csv)$/, async (ctx) => {
    const format = ctx.match[1];
    await ctx.answerCbQuery();

    const { exportClass, exportSubject } = ctx.session;

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const grades = await Grade.find({
            teacherId: teacher.teacherId,
            subject: exportSubject,
        }).sort({ studentName: 1, date: -1 });

        if (grades.length === 0) {
            ctx.reply(`🛑 No grades found for ${exportSubject} in class ${exportClass}.`, teacherMenu);
            return ctx.scene.leave();
        }

        let fileContent;
        let fileName;
        let caption;

        if (format === 'text') {
            const gradesByStudent = {};
            grades.forEach(grade => {
                if (!gradesByStudent[grade.studentId]) {
                    gradesByStudent[grade.studentId] = {
                        studentName: grade.studentName,
                        grades: []
                    };
                }
                gradesByStudent[grade.studentId].grades.push(grade);
            });

            fileContent = generateGradeReport(exportSubject, teacher.name, gradesByStudent, exportClass);
            fileName = `grades_${exportClass.replace(/ /g, '_')}_${exportSubject.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
            caption = `📊 Grade report for ${exportSubject} (Class: ${exportClass}) - ${grades.length} grades`;
        } else {
            fileContent = generateGradeCSV(exportSubject, teacher.name, grades, exportClass);
            fileName = `grades_${exportClass.replace(/ /g, '_')}_${exportSubject.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
            caption = `📊 Grade data for ${exportSubject} (Class: ${exportClass}) - ${grades.length} records`;
        }

        const tempDir = './temp_exports';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, fileContent);

        await ctx.replyWithDocument({
            source: filePath,
            filename: fileName,
            caption: caption
        });

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        ctx.reply('✅ Grade export completed!', teacherMenu);

    } catch (error) {
        console.error('Error exporting grades:', error);
        ctx.reply('🛑 An error occurred while exporting grades.', teacherMenu);
    }
    
    delete ctx.session.exportClass;
    delete ctx.session.exportSubject;
    ctx.scene.leave();
});

teacherExportGradesScene.action('cancel_export_grades', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Grade export cancelled.', teacherMenu);
    delete ctx.session.exportClass;
    delete ctx.session.exportSubject;
    ctx.scene.leave();
});

const generateGradeReport = (subject, teacherName, gradesByStudent, className) => {
    let report = `GRADE REPORT - ${subject.toUpperCase()}\n`;
    report += '='.repeat(80) + '\n\n';
    report += `Teacher: ${teacherName}\n`;
    report += `Subject: ${subject}\n`;
    report += `Class: ${className}\n`;
    report += `Report Date: ${new Date().toLocaleDateString()}\n`;
    report += `Generated: ${new Date().toLocaleString()}\n`;
    report += '='.repeat(80) + '\n\n';

    let totalStudents = Object.keys(gradesByStudent).length;
    let totalGrades = 0;
    let classTotal = 0;

    for (const [studentId, studentData] of Object.entries(gradesByStudent)) {
        report += `STUDENT: ${studentData.studentName}\n`;
        report += `ID: ${studentId}\n`;
        report += `CLASS: ${className}\n`;
        report += '-'.repeat(60) + '\n';
        
        report += 'No. Purpose         Score   Date         Comments\n';
        report += '-'.repeat(60) + '\n';

        let studentTotal = 0;
        let gradeCount = 0;

        studentData.grades.forEach((grade, index) => {
            const purpose = grade.purpose.padEnd(12);
            const score = grade.score.toString().padStart(5);
            const date = new Date(grade.date).toLocaleDateString().padEnd(12);
            const comments = grade.comments ? grade.comments.substring(0, 20) + (grade.comments.length > 20 ? '...' : '') : '';
            
            report += `${(index + 1).toString().padStart(2)}. ${purpose} ${score}  ${date} ${comments}\n`;

            studentTotal += grade.score;
            gradeCount++;
            totalGrades++;
        });

        if (gradeCount > 0) {
            const average = studentTotal / gradeCount;
            classTotal += average;
            report += '-'.repeat(60) + '\n';
            report += `AVERAGE: ${average.toFixed(2)}%\n`;
            report += `GRADES: ${gradeCount}\n`;
        }

        report += '='.repeat(60) + '\n\n';
    }

    if (totalStudents > 0) {
        const classAverage = classTotal / totalStudents;
        
        report += 'CLASS STATISTICS\n';
        report += '='.repeat(40) + '\n';
        report += `Class: ${className}\n`;
        report += `Subject: ${subject}\n`;
        report += `Total Students: ${totalStudents}\n`;
        report += `Total Grades: ${totalGrades}\n`;
        report += `Class Average: ${classAverage.toFixed(2)}%\n`;
        report += `Teacher: ${teacherName}\n`;
        report += `Report Generated: ${new Date().toLocaleString()}\n`;
        report += '='.repeat(40) + '\n';
    }

    return report;
};

const generateGradeCSV = (subject, teacherName, grades, className) => {
    let csv = 'Class,Student ID,Student Name,Subject,Score,Purpose,Date,Comments,Teacher\n';
    
    grades.forEach(grade => {
        const row = [
            `"${className.replace(/"/g, '""')}"`,
            grade.studentId,
            `"${grade.studentName.replace(/"/g, '""')}"`,
            `"${subject.replace(/"/g, '""')}"`,
            grade.score,
            `"${grade.purpose.replace(/"/g, '""')}"`,
            new Date(grade.date).toISOString().split('T')[0],
            grade.comments ? `"${grade.comments.replace(/"/g, '""')}"` : '',
            `"${teacherName.replace(/"/g, '""')}"`
        ];
        csv += row.join(',') + '\n';
    });

    return csv;
};

stage.register(teacherExportGradesScene);



// Teacher Search Student Scene
const teacherSearchStudentScene = new Scenes.BaseScene('teacher_search_student_scene');

teacherSearchStudentScene.enter((ctx) => {
    const cancelKeyboard = Markup.keyboard([
        ['🛑 Cancel Search']
    ]).resize();

    ctx.reply(
        '🔍 Search students in your database:\n\n' +
        'You can search by:\n' +
        '• Student ID (e.g., ST1234)\n' +
        '• Student Name (full or partial)\n\n' +
        'Enter your search query:',
        cancelKeyboard
    );
});
teacherSearchStudentScene.on('text', async (ctx) => {
  const query = ctx.message.text.trim();

  if (query === '🛑 Cancel Search') {
    await ctx.reply('🛑 Search cancelled.', teacherMenu);
    delete ctx.session.searchResults;
    delete ctx.session.currentPage;
    return ctx.scene.leave();
  }

  if (!query) {
    await ctx.reply('🛑 Please enter a search query.');
    return;
  }
  if (query.length < 2) {
    await ctx.reply('⚠️ Please enter at least 2 characters for a valid search.');
    return;
  }

  try {
    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    if (!teacher) {
      await ctx.reply('🛑 Teacher not found.');
      return;
    }

    const allStudents = await TeacherStudent.find({ teacherId: teacher.teacherId }).sort({ studentName: 1 });

    const q = query.toLowerCase();
    const searchResults = allStudents.filter(
      (s) =>
        s.studentName.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q)
    );

    if (searchResults.length === 0) {
      await ctx.reply('🛑 No students found matching your search.', teacherMenu);
    }

    ctx.session.searchResults = searchResults;
    ctx.session.currentPage = 0;
    ctx.session.totalPages = Math.ceil(searchResults.length / 5);

    await displaySearchResults(ctx);
  } catch (error) {
    console.error('Error searching students:', error);
    await ctx.reply('🛑 An error occurred while searching.', teacherMenu);
    ctx.scene.leave();
  }
});


teacherSearchStudentScene.action('search_prev_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.currentPage--;
    await displaySearchResults(ctx);
});

teacherSearchStudentScene.action('search_next_page', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.currentPage++;
    await displaySearchResults(ctx);
});

teacherSearchStudentScene.action('search_done', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('✅ Search completed.', teacherMenu);
    delete ctx.session.searchResults;
    delete ctx.session.currentPage;
    delete ctx.session.totalPages;
    ctx.scene.leave();
});

teacherSearchStudentScene.action('search_new', async (ctx) => {
    await ctx.answerCbQuery();
    delete ctx.session.searchResults;
    delete ctx.session.currentPage;
    delete ctx.session.totalPages;
    ctx.scene.reenter();
});

teacherSearchStudentScene.hears('🛑 Cancel Search', async (ctx) => {
    ctx.reply('🛑 Search cancelled.', teacherMenu);
    delete ctx.session.searchResults;
    delete ctx.session.currentPage;
    delete ctx.session.totalPages;
    ctx.scene.leave();
});

teacherSearchStudentScene.on('message', (ctx) => {
    if (ctx.message.text !== '🛑 Cancel Search') {
        ctx.reply('🛑 Please enter a valid search query or use the cancel button.');
    }
});
teacherSearchStudentScene.action(/^view_student_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        if (!studentRelation) {
            ctx.reply('🛑 Student not found.', teacherMenu);
            return;
        }

        const studentData = await getStudentById(studentId);
        const parent = studentData && studentData.parentId 
            ? await getUserById(studentData.parentId) 
            : null;

        let message = `📋 Student Details\n\n`;
        message += `👤 Name: ${studentRelation.studentName}\n`;
        message += `🆔 ID: <code>${studentRelation.studentId}</code>\n`;
        message += `📚 Subject: ${studentRelation.subject}\n`;
        message += `🏫 Class: ${studentRelation.className}\n\n`;

        if (parent) {
            message += `👨‍👩‍👧‍👦 Parent Information:\n`;
            message += `   • Name: ${parent.name}\n`;
            message += `   • Telegram ID: ${parent.telegramId}\n`;
            if (parent.username) {
                message += `   • Username: @${parent.username}\n`;
            }
        } else {
            message += `🛑 No parent linked\n`;
        }

        message += `\n📅 Added to your class: ${new Date(studentRelation.addedDate).toLocaleDateString()}`;

        const actionButtons = [
            [Markup.button.callback('🗑️ Remove from Class', `remove_${studentId}`)],
            [Markup.button.callback('⬅️ Back to Results', 'back_to_results')]
        ];

        ctx.replyWithHTML(message, Markup.inlineKeyboard(actionButtons));

    } catch (error) {
        console.error('Error viewing student details:', error);
        ctx.reply('🛑 An error occurred.', teacherMenu);
    }
});

const displaySearchResults = async (ctx) => {
    const { searchResults, currentPage, totalPages } = ctx.session;
    const startIndex = currentPage * 5;
    const endIndex = Math.min(startIndex + 5, searchResults.length);
    const currentResults = searchResults.slice(startIndex, endIndex);

    let message = `🔍 Search Results (${searchResults.length} found)\n\n`;
    
    const viewButtons = [];
    
    for (let i = 0; i < currentResults.length; i++) {
        const student = currentResults[i];
        const studentData = await getStudentById(student.studentId);
        const parentInfo = studentData && studentData.parentId 
            ? `👨‍👩‍👧‍👦 Parent: Linked` 
            : '👨‍👩‍👧‍👦 No parent';
        
        message += `*${startIndex + i + 1}. ${student.studentName}*\n`;
        message += `   🆔 ID: <code>${student.studentId}</code>\n`;
        message += `   📚 Subject: ${student.subject}\n`;
        message += `   🏫 Class: ${student.className}\n`;
        message += `   ${parentInfo}\n\n`;

        viewButtons.push([Markup.button.callback(
            `👀 View ${student.studentName}`,
            `view_student_${student.studentId}`
        )]);
    }

    message += `📄 Page ${currentPage + 1} of ${totalPages}\n\n`;

    const paginationButtons = [];

    if (currentPage > 0) {
        paginationButtons.push(Markup.button.callback('⬅️ Previous', 'search_prev_page'));
    }

    if (currentPage < totalPages - 1) {
        paginationButtons.push(Markup.button.callback('Next ➡️', 'search_next_page'));
    }

    paginationButtons.push(Markup.button.callback('✅ Done', 'search_done'));
    paginationButtons.push(Markup.button.callback('🔄 New Search', 'search_new'));

    const allButtons = [...viewButtons, paginationButtons];

    ctx.replyWithHTML(message, Markup.inlineKeyboard(allButtons));
};

teacherSearchStudentScene.action(/^contact_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        const studentData = await getStudentById(studentId);
        
        if (!studentData || !studentData.parentId) {
            ctx.reply('🛑 Student has no linked parent.', teacherMenu);
            return;
        }

        ctx.session.contactInfo = {
            studentId: studentId,
            studentName: studentRelation.studentName,
            parentId: studentData.parentId,
            subject: studentRelation.subject
        };

        const parent = await getUserById(studentData.parentId);
        const parentName = parent ? parent.name : 'Parent';

        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel Message']
        ]).resize();

        ctx.reply(
            `📞 Ready to contact ${parentName}, parent of ${studentRelation.studentName}:\n\n` +
            `Please type your message:`,
            cancelKeyboard
        );

    } catch (error) {
        console.error('Error preparing contact:', error);
        ctx.reply('🛑 An error occurred.', teacherMenu);
    }
});

teacherSearchStudentScene.action(/^remove_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        ctx.reply(
            `⚠️ Confirm Removal\n\n` +
            `Are you sure you want to remove ${studentRelation.studentName} (${studentId}) ` +
            `from your ${studentRelation.subject} class?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Remove', `confirm_remove_${studentId}`)],
                [Markup.button.callback('🛑 No, Cancel', 'back_to_results')]
            ])
        );

    } catch (error) {
        console.error('Error preparing removal:', error);
        ctx.reply('🛑 An error occurred.', teacherMenu);
    }
});

teacherSearchStudentScene.action(/^confirm_remove_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        await TeacherStudent.deleteOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: studentRelation.subject
        });

        ctx.reply(
            `✅ Successfully removed ${studentRelation.studentName} from your ${studentRelation.subject} class.`,
            teacherMenu
        );

        delete ctx.session.searchResults;
        delete ctx.session.currentPage;
        delete ctx.session.totalPages;
        ctx.scene.leave();

    } catch (error) {
        console.error('Error removing student:', error);
        ctx.reply('🛑 An error occurred while removing the student.', teacherMenu);
    }
});

teacherSearchStudentScene.action('back_to_results', async (ctx) => {
    await ctx.answerCbQuery();
    await displaySearchResults(ctx);
});

teacherSearchStudentScene.on('text', async (ctx) => {
    const message = ctx.message.text.trim();
    
    if (message === '🛑 Cancel Message') {
        ctx.reply('🛑 Message cancelled.', teacherMenu);
        delete ctx.session.contactInfo;
        return;
    }

    const contactInfo = ctx.session.contactInfo;
    if (!contactInfo) {
        return; 
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const parent = await getUserById(contactInfo.parentId);
        
        await ctx.telegram.sendMessage(
            contactInfo.parentId,
            `📞 Message from ${teacher.name} (${contactInfo.subject} Teacher):\n${message}`,
            { parse_mode: "HTML" }
        );

        ctx.reply(
            `✅ Message sent to ${parent.name}, parent of ${contactInfo.studentName}.`,
            teacherMenu
        );

    } catch (error) {
        if (error.response?.error_code === 403) {
            ctx.reply('🛑 Failed to send message. The parent may have blocked the bot.', teacherMenu);
        } else {
            console.error('Error sending message:', error);
            ctx.reply('🛑 An error occurred while sending the message.', teacherMenu);
        }
    }
    
    delete ctx.session.contactInfo;
    ctx.scene.leave();
});
stage.register(teacherSearchStudentScene);

//contact parent teacher
const teacherContactParentScene = new Scenes.BaseScene('teacher_contact_parent_scene');

teacherContactParentScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher) {
            ctx.reply('🛑 Teacher profile not found.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.contactStudentId = null;
        ctx.session.contactStudentName = null;
        ctx.session.contactParentId = null;
        ctx.session.contactParentName = null;

        ctx.replyWithHTML(
            '💬 Contact a Parent\n\n' +
            'Enter the Student ID to contact their parent:\n\n' +
            '📋 Format: ST1234 \n' +
            '💡 Tip: Use the student ID from your class list.',
            Markup.keyboard([['🛑 Cancel']]).resize()
        );

    } catch (error) {
        console.error('Error entering contact parent scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherContactParentScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim().toUpperCase();

    if (input === '🛑 CANCEL') {
        ctx.reply('🛑 Contact cancelled.', teacherMenu);
        ctx.session.contactStudentId = null;
        ctx.session.contactStudentName = null;
        ctx.session.contactParentId = null;
        ctx.session.contactParentName = null;
        return ctx.scene.leave();
    }

    if (ctx.session.contactStudentId) {
        await forwardToParent(ctx, { type: 'text', content: ctx.message.text });
        return;
    }

    const normalizedId = input.replace(/-/g, '');
    if (!/^ST\d{4}$/i.test(normalizedId)) {
        return ctx.replyWithHTML(
            '🛑 Invalid Student ID Format\n\n' +
            'Please enter a valid ID like: ST1234\n\n' +
            'Try again:'
        );
    }

    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    const student = await Student.findOne({ studentId: normalizedId });
    if (!teacher || !student) {
        return ctx.reply('🛑 Student or teacher not found.');
    }

    const relation = await TeacherStudent.findOne({ teacherId: teacher.teacherId, studentId: normalizedId });
    if (!relation) {
        return ctx.reply(`🛑 Student ${student.name} is not available in your class.`);
    }

    if (!student.parentId) {
        return ctx.reply(`🛑 No parent linked for ${student.name}.`);
    }

    const parent = await User.findOne({ telegramId: student.parentId });
    if (!parent) {
        return ctx.reply('🛑 Parent profile invalid.');
    }

    ctx.session.contactStudentId = normalizedId;
    ctx.session.contactStudentName = student.name;
    ctx.session.contactParentId = parent.telegramId;
    ctx.session.contactParentName = parent.name;

    ctx.replyWithHTML(
        `✅ Student Found\n\n` +
        `👨‍🎓 Student: ${student.name} (${normalizedId})\n` +
        `👨‍👩‍👧 Parent: ${parent.name}\n\n` +
        'Now send your message (text, photo, video, audio, or document):',
        Markup.keyboard([['🛑 Cancel']]).resize()
    );
});

teacherContactParentScene.on(['photo', 'video', 'audio', 'voice', 'document', 'sticker', 'animation'], async (ctx) => {
    if (!ctx.session.contactParentId) {
        return ctx.reply('🛑 Please select a student first.');
    }

    const type = Object.keys(ctx.message).find(k => ['photo', 'video', 'audio', 'voice', 'document', 'sticker', 'animation'].includes(k));
    const fileId = ctx.message[type]?.file_id || (ctx.message.photo ? ctx.message.photo.slice(-1)[0].file_id : null);

    if (!fileId) {
        return ctx.reply('🛑 Could not extract media file.');
    }

    await forwardToParent(ctx, { type, fileId, caption: ctx.message.caption || '' });
});

// --- Helper: forward any content to parent ---
async function forwardToParent(ctx, { type, content, fileId, caption }) {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const { contactParentId, contactStudentName, contactStudentId, contactParentName } = ctx.session;

        switch (type) {
            case 'text':
                await ctx.telegram.sendMessage(contactParentId,
                    `📩 Message from Teacher\n\n` +
                    `👨‍🏫 From: ${teacher.name} (${teacher.teacherId})\n` +
                    `👨‍🎓 About Student: ${contactStudentName} (${contactStudentId})\n\n` +
                    `💬 ${content}`);
                break;
            case 'photo':
                await ctx.telegram.sendPhoto(contactParentId, fileId, { caption });
                break;
            case 'video':
                await ctx.telegram.sendVideo(contactParentId, fileId, { caption });
                break;
            case 'audio':
                await ctx.telegram.sendAudio(contactParentId, fileId, { caption });
                break;
            case 'voice':
                await ctx.telegram.sendVoice(contactParentId, fileId, { caption });
                break;
            case 'document':
                await ctx.telegram.sendDocument(contactParentId, fileId, { caption });
                break;
            case 'sticker':
                await ctx.telegram.sendSticker(contactParentId, fileId);
                break;
            case 'animation':
                await ctx.telegram.sendAnimation(contactParentId, fileId, { caption });
                break;
        }

        // Confirm to teacher
        ctx.replyWithHTML(
            `✅ Message Sent to Parent: ${contactParentName}\n` +
            `👨‍🎓 Student: ${contactStudentName}\n` +
            `🗂 Type: ${type}`,
            teacherMenu
        );

       

        // Clear session after sending
        ctx.session.contactStudentId = null;
        ctx.session.contactStudentName = null;
        ctx.session.contactParentId = null;
        ctx.session.contactParentName = null;
        ctx.scene.leave();

    } catch (err) {
        console.error('Error forwarding to parent:', err);
        ctx.reply('🛑 Failed to send message. Parent may have blocked the bot.');
        ctx.scene.leave();
    }
}

stage.register(teacherContactParentScene);






// Contact by ID Scene
const contactParentByIdScene = new Scenes.BaseScene('contact_parent_by_id_scene');

contactParentByIdScene.enter((ctx) => {
    const cancelKeyboard = Markup.keyboard([
        ['🛑 Cancel Operation']
    ]).resize();

    ctx.reply('🆔 Please enter the Student ID to contact their parent:', cancelKeyboard);
});

contactParentByIdScene.on('text', async (ctx) => {
    const studentId = ctx.message.text.trim();
    
    if (studentId === '🛑 Cancel Operation') {
        ctx.reply('🛑 Contact parent cancelled.', teacherMenu);
        return ctx.scene.leave();
    }

    if (!isValidStudentId(studentId)) {
        ctx.reply('🛑 Invalid Student ID. Please provide a valid student ID (e.g., ST1234).');
        return;
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        if (!studentRelation) {
            ctx.reply('🛑 Student not found in your database. Please check the Student ID.', teacherMenu);
            return ctx.scene.leave();
        }

        const student = await getStudentById(studentId);
        if (!student || !student.parentId) {
            ctx.reply('🛑 Student has no linked parent or parent not found.', teacherMenu);
            return ctx.scene.leave();
        }

        const parent = await getUserById(student.parentId);
        if (!parent) {
            ctx.reply('🛑 Parent not found for this student.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.contactInfo = {
            studentId: studentId,
            studentName: studentRelation.studentName,
            parentId: student.parentId,
            parentName: parent.name,
            subject: studentRelation.subject
        };

        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel Message']
        ]).resize();

        ctx.reply(
            `📞 Ready to contact parent of ${studentRelation.studentName}:\n\n` +
            `👤 Student: ${studentRelation.studentName} (${studentId})\n` +
            `📚 Subject: ${studentRelation.subject}\n` +
            `👨‍👩‍👧‍👦 Parent: ${parent.name}\n\n` +
            `Please type your message to send to the parent:`,
            cancelKeyboard
        );

    } catch (error) {
        console.error('Error processing student ID:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

contactParentByIdScene.on('text', async (ctx) => {
    const message = ctx.message.text.trim();
    
    if (message === '🛑 Cancel Message') {
        ctx.reply('🛑 Message cancelled.', teacherMenu);
        delete ctx.session.contactInfo;
        return ctx.scene.leave();
    }

    const contactInfo = ctx.session.contactInfo;
    if (!contactInfo) {
        ctx.reply('🛑 Contact information not found. Please start over.', teacherMenu);
        return ctx.scene.leave();
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        await ctx.telegram.sendMessage(
            contactInfo.parentId,
            `📞 Message from ${teacher.name} (${contactInfo.subject} Teacher):\n${message}`,
            { parse_mode: "HTML" }
        );

        ctx.reply(
            `✅ Message sent to ${contactInfo.parentName}, parent of ${contactInfo.studentName}.`,
            teacherMenu
        );

    } catch (error) {
        if (error.response?.error_code === 403) {
            ctx.reply('🛑 Failed to send message. The parent may have blocked the bot.', teacherMenu);
        } else {
            console.error('Error sending message:', error);
            ctx.reply('🛑 An error occurred while sending the message.', teacherMenu);
        }
    }
    
    delete ctx.session.contactInfo;
    ctx.scene.leave();
});

contactParentByIdScene.hears('🛑 Cancel Operation', async (ctx) => {
    ctx.reply('🛑 Contact parent cancelled.', teacherMenu);
    delete ctx.session.contactInfo;
    ctx.scene.leave();
});


// Contact by List Scene
const contactParentByListScene = new Scenes.BaseScene('contact_parent_by_list_scene');

contactParentByListScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const subjectsWithStudents = await TeacherStudent.aggregate([
            { $match: { teacherId: teacher.teacherId } },
            { $group: { _id: '$subject', count: { $sum: 1 } } },
            { $match: { count: { $gt: 0 } } }
        ]);

        if (subjectsWithStudents.length === 0) {
            ctx.reply('🛑 You have no students in any subjects.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = subjectsWithStudents.map(subject => 
            [Markup.button.callback(`${subject._id} (${subject.count} students)`, `contact_from_subject_${subject._id.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_contact_list')]);

        ctx.reply('📚 Select a subject to contact parents from:', Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        console.error('Error in contact by list scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

contactParentByListScene.action(/^contact_from_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found in ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        const studentsWithParents = await Promise.all(
            students.map(async (student) => {
                const studentData = await getStudentById(student.studentId);
                const hasParent = studentData && studentData.parentId;
                return {
                    ...student.toObject(),
                    hasParent: hasParent,
                    parentId: hasParent ? studentData.parentId : null
                };
            })
        );

        const studentsWithValidParents = studentsWithParents.filter(s => s.hasParent);

        if (studentsWithValidParents.length === 0) {
            ctx.reply(`🛑 No students in ${subject} have linked parents.`, teacherMenu);
            return ctx.scene.leave();
        }

        const studentButtons = studentsWithValidParents.map(student => 
            [Markup.button.callback(
                `${student.studentName} (${student.studentId})`, 
                `contact_parent_${student.studentId}_${subject.replace(/ /g, '_')}`
            )]
        );
        
        studentButtons.push(
            [Markup.button.callback('⬅️ Back to Subjects', 'back_to_subjects_contact')],
            [Markup.button.callback('🛑 Cancel', 'cancel_contact_list')]
        );

        ctx.reply(
            `👥 Students in ${subject} with parents:\n\n` +
            `Select a student to contact their parent:`,
            Markup.inlineKeyboard(studentButtons)
        );

    } catch (error) {
        console.error('Error selecting subject:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

contactParentByListScene.action(/^contact_parent_(.+)_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    const subject = ctx.match[2].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const student = await getStudentById(studentId);
        const parent = await getUserById(student.parentId);
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: subject
        });

        if (!student || !parent || !studentRelation) {
            ctx.reply('🛑 Student or parent information not found.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.contactInfo = {
            studentId: studentId,
            studentName: studentRelation.studentName,
            parentId: student.parentId,
            parentName: parent.name,
            subject: subject
        };

        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel Message']
        ]).resize();

        ctx.reply(
            `📞 Ready to contact parent of ${studentRelation.studentName}:\n\n` +
            `👤 Student: ${studentRelation.studentName} (${studentId})\n` +
            `📚 Subject: ${subject}\n` +
            `👨‍👩‍👧‍👦 Parent: ${parent.name}\n\n` +
            `Please type your message to send to the parent:`,
            cancelKeyboard
        );

    } catch (error) {
        console.error('Error selecting student:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

contactParentByListScene.on('text', async (ctx) => {
    const message = ctx.message.text.trim();
    
    if (message === '🛑 Cancel Message') {
        ctx.reply('🛑 Message cancelled.', teacherMenu);
        delete ctx.session.contactInfo;
        return ctx.scene.leave();
    }

    const contactInfo = ctx.session.contactInfo;
    if (!contactInfo) {
        return; 
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        await ctx.telegram.sendMessage(
            contactInfo.parentId,
            `📞 Message from ${teacher.name} (${contactInfo.subject} Teacher):\n${message}`,
            { parse_mode: "HTML" }
        );

        ctx.reply(
            `✅ Message sent to ${contactInfo.parentName}, parent of ${contactInfo.studentName}.`,
            teacherMenu
        );

    } catch (error) {
        if (error.response?.error_code === 403) {
            ctx.reply('🛑 Failed to send message. The parent may have blocked the bot.', teacherMenu);
        } else {
            console.error('Error sending message:', error);
            ctx.reply('🛑 An error occurred while sending the message.', teacherMenu);
        }
    }
    
    delete ctx.session.contactInfo;
    ctx.scene.leave();
});

contactParentByListScene.action('back_to_subjects_contact', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.reenter(); 
});

contactParentByListScene.action('cancel_contact_list', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Contact parent cancelled.', teacherMenu);
    delete ctx.session.contactInfo;
    ctx.scene.leave();
});


stage.register(teacherContactParentScene);
stage.register(contactParentByIdScene);
stage.register(contactParentByListScene);
//
//TEACHER REMOVE STUDENT
const teacherRemoveStudentScene = new Scenes.BaseScene('teacher_remove_student_scene');

teacherRemoveStudentScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher) {
            ctx.reply('🛑 Teacher profile not found.', teacherMenu);
            return ctx.scene.leave();
        }

        const studentCount = await TeacherStudent.countDocuments({ teacherId: teacher.teacherId });
        
        if (studentCount === 0) {
            ctx.reply('🛑 You have no students in your database.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.reply(
            '🗑️ How would you like to remove students?',
            Markup.inlineKeyboard([
                [Markup.button.callback('🆔 Remove by Student ID', 'remove_by_id')],
                [Markup.button.callback('📋 Remove from Subject List', 'remove_by_list')],
                [Markup.button.callback('🛑 Cancel', 'cancel_remove_student')]
            ])
        );

    } catch (error) {
        console.error('Error in teacher remove student scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});
teacherRemoveStudentScene.action('remove_by_id', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('remove_student_by_id_scene');
});

teacherRemoveStudentScene.action('remove_by_list', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('remove_student_by_list_scene');
});

teacherRemoveStudentScene.action('cancel_remove_student', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Student removal cancelled.', teacherMenu);
    ctx.scene.leave();
});
const removeStudentByIdScene = new Scenes.BaseScene('remove_student_by_id_scene');

removeStudentByIdScene.enter((ctx) => {
    const cancelKeyboard = Markup.keyboard([
        ['🛑 Cancel Operation']
    ]).resize();

    ctx.reply('🆔 Please enter the Student ID to remove from your database:', cancelKeyboard);
});

removeStudentByIdScene.on('text', async (ctx) => {
    const studentId = ctx.message.text.trim();
    
    if (studentId === '🛑 Cancel Operation') {
        ctx.reply('🛑 Student removal cancelled.', teacherMenu);
        return ctx.scene.leave();
    }

    if (!isValidStudentId(studentId)) {
        ctx.reply('🛑 Invalid Student ID. Please provide a valid student ID (e.g., ST1234).');
        return;
    }

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        if (!studentRelation) {
            ctx.reply('🛑 Student not found in your database. Please check the Student ID.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.studentToRemove = {
            studentId: studentId,
            studentName: studentRelation.studentName,
            subject: studentRelation.subject
        };

        ctx.reply(
            `⚠️ Confirm Removal\n\n` +
            `Are you sure you want to remove ${studentRelation.studentName} (${studentId}) ` +
            `from your ${studentRelation.subject} class?\n\n` +
            `This will only remove them from your database, not from the school system.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Remove', 'confirm_remove_by_id')],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_remove_operation')]
            ])
        );

    } catch (error) {
        console.error('Error processing student ID:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

removeStudentByIdScene.action('confirm_remove_by_id', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const { studentId, studentName, subject } = ctx.session.studentToRemove;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        await TeacherStudent.deleteOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: subject
        });

        ctx.reply(
            `✅ Successfully removed ${studentName} (${studentId}) from your ${subject} class.`,
            teacherMenu
        );

    } catch (error) {
        console.error('Error removing student:', error);
        ctx.reply('🛑 An error occurred while removing the student.', teacherMenu);
    }
    
    delete ctx.session.studentToRemove;
    ctx.scene.leave();
});

removeStudentByIdScene.action('cancel_remove_operation', async (ctx) => {
    await ctx.answerCb

    Query();
    ctx.reply('🛑 Student removal cancelled.', teacherMenu);
    delete ctx.session.studentToRemove;
    ctx.scene.leave();
});

removeStudentByIdScene.hears('🛑 Cancel Operation', async (ctx) => {
    ctx.reply('🛑 Student removal cancelled.', teacherMenu);
    delete ctx.session.studentToRemove;
    ctx.scene.leave();
});


// Remove by List Scene
const removeStudentByListScene = new Scenes.BaseScene('remove_student_by_list_scene');

removeStudentByListScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const subjectsWithStudents = await TeacherStudent.aggregate([
            { $match: { teacherId: teacher.teacherId } },
            { $group: { _id: '$subject', count: { $sum: 1 } } },
            { $match: { count: { $gt: 0 } } }
        ]);

        if (subjectsWithStudents.length === 0) {
            ctx.reply('🛑 You have no students in any subjects.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = subjectsWithStudents.map(subject => 
            [Markup.button.callback(`${subject._id} (${subject.count} students)`, `remove_from_subject_${subject._id.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_remove_list')]);

        ctx.reply('📚 Select a subject to remove students from:', Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        console.error('Error in remove by list scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

removeStudentByListScene.action(/^remove_from_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const students = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        }).sort({ studentName: 1 });

        if (students.length === 0) {
            ctx.reply(`🛑 No students found in ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        const studentButtons = students.map(student => 
            [Markup.button.callback(
                `${student.studentName} (${student.studentId})`, 
                `remove_student_${student.studentId}_${subject.replace(/ /g, '_')}`
            )]
        );
        
        studentButtons.push(
            [Markup.button.callback('⬅️ Back to Subjects', 'back_to_subjects_list')],
            [Markup.button.callback('🛑 Cancel', 'cancel_remove_list')]
        );

        ctx.reply(
            `👥 Students in ${subject}:\n\n` +
            `Select a student to remove:`,
            Markup.inlineKeyboard(studentButtons)
        );

    } catch (error) {
        console.error('Error selecting subject:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

removeStudentByListScene.action(/^remove_student_(.+)_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    const subject = ctx.match[2].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const studentRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: subject
        });

        if (!studentRelation) {
            ctx.reply('🛑 Student not found.', teacherMenu);
            return ctx.scene.leave();
        }

        ctx.reply(
            `⚠️ Confirm Removal\n\n` +
            `Are you sure you want to remove ${studentRelation.studentName} (${studentId}) ` +
            `from your ${subject} class?\n\n` +
            `This will only remove them from your database, not from the school system.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Remove', `confirm_list_remove_${studentId}_${subject.replace(/ /g, '_')}`)],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_remove_list')]
            ])
        );

    } catch (error) {
        console.error('Error selecting student:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

removeStudentByListScene.action(/^confirm_list_remove_(.+)_(.+)$/, async (ctx) => {
    const studentId = ctx.match[1];
    const subject = ctx.match[2].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const result = await TeacherStudent.deleteOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: subject
        });

        if (result.deletedCount > 0) {
            ctx.reply(
                `✅ Successfully removed student from your ${subject} class.`,
                teacherMenu
            );
        } else {
            ctx.reply('🛑 Student not found or already removed.', teacherMenu);
        }

    } catch (error) {
        console.error('Error removing student:', error);
        ctx.reply('🛑 An error occurred while removing the student.', teacherMenu);
    }
    
    ctx.scene.leave();
});

removeStudentByListScene.action('back_to_subjects_list', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.reenter(); 
});

removeStudentByListScene.action('cancel_remove_list', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Student removal cancelled.', teacherMenu);
    ctx.scene.leave();
});
stage.register(teacherRemoveStudentScene);
stage.register(removeStudentByIdScene);
stage.register(removeStudentByListScene);



// Announce Class Scene
const announceClassScene = new Scenes.BaseScene('announce_class_scene');

announceClassScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!teacher || !teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no subjects assigned.', teacherMenu);
            return ctx.scene.leave();
        }

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `announce_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_announcement')]);

        ctx.reply('📚 Select the subject to announce to:', Markup.inlineKeyboard(subjectButtons));

    } catch (error) {
        console.error('Error in announce class scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

announceClassScene.action(/^announce_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        const studentRelations = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            subject: subject
        });

        if (studentRelations.length === 0) {
            ctx.reply(`🛑 No students found for ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        const studentIds = studentRelations.map(rel => rel.studentId);
        const students = await Student.find({ studentId: { $in: studentIds } });
        const parentIds = [...new Set(students.map(s => s.parentId).filter(id => id !== null))];

        if (parentIds.length === 0) {
            ctx.reply(`🛑 No parents found for students in ${subject}.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.announcementData = {
            subject: subject,
            parentIds: parentIds,
            studentCount: studentRelations.length,
            parentCount: parentIds.length
        };

        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel Announcement']
        ]).resize();

        ctx.reply(
            `📢 Ready to announce to ${subject} class!\n\n` +
            `• Students: ${studentRelations.length}\n` +
            `• Parents: ${parentIds.length}\n\n` +
            `Please send your announcement (text, photo, video, document, audio, or voice):`,
            cancelKeyboard
        );

    } catch (error) {
        console.error('Error selecting subject for announcement:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

announceClassScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
    const announcementData = ctx.session.announcementData;
    
    if (!announcementData) {
        ctx.reply('🛑 No subject selected. Please start over.', teacherMenu);
        return ctx.scene.leave();
    }

    const { subject, parentIds, studentCount, parentCount } = announcementData;
    const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
    const teacherName = teacher?.name || 'Teacher';

    let successCount = 0;
    let failedCount = 0;
    const failedParents = [];

    try {
        for (const parentId of parentIds) {
            try {
                if (ctx.message.text) {
                    await ctx.telegram.sendMessage(
                        parentId,
                        `📢 Announcement from ${teacherName} (${subject}):\n${ctx.message.text}`,
                        { parse_mode: "HTML" }
                    );
                    successCount++;
                } 
                else if (ctx.message.photo) {
                    const photo = ctx.message.photo[ctx.message.photo.length - 1];
                    const caption = ctx.message.caption 
                        ? `📢 Announcement from ${teacherName} (${subject}):\n${ctx.message.caption}`
                        : `📢 Announcement from ${teacherName} (${subject})`;
                    
                    await ctx.telegram.sendPhoto(
                        parentId,
                        photo.file_id,
                        { caption, parse_mode: "HTML" }
                    );
                    successCount++;
                }
                else if (ctx.message.video) {
                    const caption = ctx.message.caption 
                        ? `📢 Announcement from ${teacherName} (${subject}):\n${ctx.message.caption}`
                        : `📢 Announcement from ${teacherName} (${subject})`;
                    
                    await ctx.telegram.sendVideo(
                        parentId,
                        ctx.message.video.file_id,
                        { caption, parse_mode: "HTML" }
                    );
                    successCount++;
                }
                else if (ctx.message.document) {
                    const caption = ctx.message.caption 
                        ? `📢 Announcement from ${teacherName} (${subject}):\n${ctx.message.caption}`
                        : `📢 Announcement from ${teacherName} (${subject})`;
                    
                    await ctx.telegram.sendDocument(
                        parentId,
                        ctx.message.document.file_id,
                        { caption, parse_mode: "HTML" }
                    );
                    successCount++;
                }
                else if (ctx.message.audio) {
                    const caption = ctx.message.caption 
                        ? `📢 Announcement from ${teacherName} (${subject}):\n${ctx.message.caption}`
                        : `📢 Announcement from ${teacherName} (${subject})`;
                    
                    await ctx.telegram.sendAudio(
                        parentId,
                        ctx.message.audio.file_id,
                        { caption, parse_mode: "HTML" }
                    );
                    successCount++;
                }
                else if (ctx.message.voice) {
                    await ctx.telegram.sendVoice(
                        parentId,
                        ctx.message.voice.file_id
                    );
                    await ctx.telegram.sendMessage(
                        parentId,
                        `🗣️ Voice announcement from ${teacherName} (${subject})`,
                        { parse_mode: "HTML" }
                    );
                    successCount++;
                }
            } catch (error) {
                if (error.response?.error_code === 403) {
                    failedCount++;
                    failedParents.push(parentId);
                } else {
                    console.error(`Failed to send to parent ${parentId}:`, error);
                    failedCount++;
                    failedParents.push(parentId);
                }
            }
        }

        let summaryMessage = `✅ Announcement sent!\n\n`;
        summaryMessage += `📚 Subject: ${subject}\n`;
        summaryMessage += `👥 Students: ${studentCount}\n`;
        summaryMessage += `👨‍👩‍👧‍👦 Parents: ${parentCount}\n`;
        summaryMessage += `✅ Successful: ${successCount}\n`;
        
        if (failedCount > 0) {
            summaryMessage += `🛑 Failed: ${failedCount}\n`;
            if (failedParents.length > 0) {
                summaryMessage += `\nFailed to send to ${failedCount} parent(s).`;
            }
        }

        ctx.reply(summaryMessage, teacherMenu);

    } catch (error) {
        console.error('Error sending announcement:', error);
        ctx.reply('🛑 An error occurred while sending the announcement.', teacherMenu);
    }

    delete ctx.session.announcementData;
    ctx.scene.leave();
});

announceClassScene.action('cancel_announcement', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Announcement cancelled.', teacherMenu);
    delete ctx.session.announcementData;
    ctx.scene.leave();
});

announceClassScene.hears('🛑 Cancel Announcement', async (ctx) => {
    ctx.reply('🛑 Announcement cancelled.', teacherMenu);
    delete ctx.session.announcementData;
    ctx.scene.leave();
});

announceClassScene.on('message', (ctx) => {
    ctx.reply('🛑 Unsupported message type. Please send text, photo, video, document, audio, or voice.');
});
stage.register(announceClassScene);

//ADD A SINGLe STUDENT FOR TEACHERS
const teacherAddStudentScene = new Scenes.BaseScene('teacher_add_student_scene');

teacherAddStudentScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher || !teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no subjects assigned. Please add subjects first.', teacherMenu);
            return ctx.scene.leave();
        }

        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel']
        ]).resize();

        ctx.reply('🆔 Please enter the Student ID you want to add to your class:', cancelKeyboard);
    } catch (error) {
        console.error('Error in teacher add student scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherAddStudentScene.on('text', async (ctx) => {
    const studentId = ctx.message.text.trim();
    
    if (studentId === '🛑 Cancel') {
        ctx.reply('🛑 Student addition cancelled.', teacherMenu);
        return ctx.scene.leave();
    }

    if (!isValidStudentId(studentId)) {
        ctx.reply('🛑 Invalid Student ID. Please provide a valid student ID (e.g., ST1234).');
        return;
    }

    try {
        const student = await getStudentById(studentId);
        if (!student) {
            ctx.reply('🛑 Student not found. Please check the Student ID and try again.');
            return;
        }

        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        ctx.session.studentToAdd = {
            studentId: student.studentId,
            studentName: student.name,
            className: student.class
        };

        const subjectButtons = teacher.subjects.map(subject => 
            [Markup.button.callback(subject, `add_to_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push(
            [Markup.button.callback('📚 All Subjects', 'add_to_all_subjects')],
            [Markup.button.callback('🛑 Cancel', 'cancel_add_student')]
        );

        ctx.reply(
            `👤 Student: ${student.name} (${studentId})\n🏫 Class: ${student.class}\n\n` +
            `Select which subject(s) to add this student to:`,
            Markup.inlineKeyboard(subjectButtons)
        );

    } catch (error) {
        console.error('Error processing student ID:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherAddStudentScene.action(/^add_to_subject_(.+)$/, async (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const { studentId, studentName, className } = ctx.session.studentToAdd;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        const existingRelation = await TeacherStudent.findOne({
            teacherId: teacher.teacherId,
            studentId: studentId,
            subject: subject
        });

        if (existingRelation) {
            ctx.reply(`🛑 Student ${studentName} is already in your ${subject} class.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.selectedSubject = subject;
        
        ctx.reply(
            `📝 Confirm adding student:\n\n` +
            `👤 Student: ${studentName}\n` +
            `🆔 ID: <code>${studentId}</code>\n` +
            `🏫 Class: ${className}\n` +
            `📚 Subject: ${subject}\n\n` +
            `Are you sure you want to add this student to your class?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Add Student', 'confirm_add_student')],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_add_student')]
            ])
        );

    } catch (error) {
        console.error('Error selecting subject:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherAddStudentScene.action('add_to_all_subjects', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const { studentId, studentName, className } = ctx.session.studentToAdd;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        const existingRelations = await TeacherStudent.find({
            teacherId: teacher.teacherId,
            studentId: studentId
        });

        const existingSubjects = existingRelations.map(rel => rel.subject);
        const subjectsToAdd = teacher.subjects.filter(subject => !existingSubjects.includes(subject));

        if (subjectsToAdd.length === 0) {
            ctx.reply(`🛑 Student ${studentName} is already in all your subjects.`, teacherMenu);
            return ctx.scene.leave();
        }

        ctx.session.subjectsToAdd = subjectsToAdd;
        
        ctx.reply(
            `📝 Confirm adding student to all subjects:\n\n` +
            `👤 Student: ${studentName}\n` +
            `🆔 ID: <code>${studentId}</code>\n` +
            `🏫 Class: ${className}\n` +
            `📚 Subjects: ${subjectsToAdd.join(', ')}\n\n` +
            `Are you sure you want to add this student to all these subjects?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Add to All', 'confirm_add_all_subjects')],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_add_student')]
            ])
        );

    } catch (error) {
        console.error('Error selecting all subjects:', error);
        ctx.reply('🛑 An error occurred. Please try again.', teacherMenu);
        ctx.scene.leave();
    }
});

teacherAddStudentScene.action('confirm_add_student', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const { studentId, studentName, className } = ctx.session.studentToAdd;
        const subject = ctx.session.selectedSubject;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        const newRelation = new TeacherStudent({
            teacherId: teacher.teacherId,
            teacherName: teacher.name,
            studentId: studentId,
            studentName: studentName,
            subject: subject,
            className: className
        });

        await newRelation.save();

        ctx.reply(
            `✅ Successfully added ${studentName} to your ${subject} class!`,
            teacherMenu
        );

    } catch (error) {
        console.error('Error adding student:', error);
        ctx.reply('🛑 An error occurred while adding the student.', teacherMenu);
    }
    
    delete ctx.session.studentToAdd;
    delete ctx.session.selectedSubject;
    ctx.scene.leave();
});

teacherAddStudentScene.action('confirm_add_all_subjects', async (ctx) => {
    await ctx.answerCbQuery();

    try {
        const { studentId, studentName, className } = ctx.session.studentToAdd;
        const subjects = ctx.session.subjectsToAdd;
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        let addedCount = 0;
        const addedSubjects = [];

        for (const subject of subjects) {
            try {
                const newRelation = new TeacherStudent({
                    teacherId: teacher.teacherId,
                    teacherName: teacher.name,
                    studentId: studentId,
                    studentName: studentName,
                    subject: subject,
                    className: className
                });

                await newRelation.save();
                addedCount++;
                addedSubjects.push(subject);
            } catch (error) {
                if (error.code !== 11000) { // Ignore duplicate key errors
                    console.error(`Error adding student to ${subject}:`, error);
                }
            }
        }

        if (addedCount > 0) {
            ctx.reply(
                `✅ Successfully added ${studentName} to ${addedCount} subject(s):\n` +
                `${addedSubjects.join(', ')}`,
                teacherMenu
            );
        } else {
            ctx.reply(
                `🛑 Could not add ${studentName} to any subjects. They may already be in all your classes.`,
                teacherMenu
            );
        }

    } catch (error) {
        console.error('Error adding student to all subjects:', error);
        ctx.reply('🛑 An error occurred while adding the student.', teacherMenu);
    }
    
    delete ctx.session.studentToAdd;
    delete ctx.session.subjectsToAdd;
    ctx.scene.leave();
});

teacherAddStudentScene.action('cancel_add_student', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Student addition cancelled.', teacherMenu);
    
    delete ctx.session.studentToAdd;
    delete ctx.session.selectedSubject;
    delete ctx.session.subjectsToAdd;
    
    ctx.scene.leave();
});

teacherAddStudentScene.hears('🛑 Cancel', async (ctx) => {
    ctx.reply('🛑 Student addition cancelled.', teacherMenu);
    
    delete ctx.session.studentToAdd;
    delete ctx.session.selectedSubject;
    delete ctx.session.subjectsToAdd;
    
    ctx.scene.leave();
});

stage.register(teacherAddStudentScene);




// --- Contact Parent (Admin) Scene ---
const contactParentAdminScene = new Scenes.BaseScene('contact_parent_admin_scene');

contactParentAdminScene.enter(async (ctx) => {
  ctx.session.searchResults = [];
  ctx.session.page = 1;

  await ctx.reply(
    '🔍 Please enter the student ID (e.g. ST1234) or the beginning of the student name to find their parent.\n\n' +
    '🛑 Type "Cancel" or press the Cancel button to exit.',
    Markup.keyboard([['🛑 Cancel']]).resize()
  );
});

contactParentAdminScene.on('text', async (ctx) => {
  try {
    const query = ctx.message.text.trim();

    if (query.toLowerCase() === 'cancel' || query === '🛑 Cancel') {
      await ctx.reply('🛑 Cancelled contacting parent.', adminMenu);
      await logAdminAction(ctx, 'CONTACT_PARENT_CANCELLED', { adminId: ctx.from.id });
      return ctx.scene.leave();
    }

    const allStudents = await Student.find();

    const students = allStudents.filter(s => {
      if (!s.parentId) return false; // must have linked parent
      const q = query.toLowerCase();
      return (
        (s.studentId && s.studentId.toLowerCase().startsWith(q)) ||
        (s.name && s.name.toLowerCase().startsWith(q))
      );
    });

    if (students.length === 0) {
      await ctx.reply('🛑 No students with linked parents found. Try again.');
      return;
    }

    ctx.session.searchResults = students;
    ctx.session.page = 1;

    await logAdminAction(ctx, 'CONTACT_PARENT_SEARCH', {
      query,
      results: students.length,
      adminId: ctx.from.id
    });

    await notifyMasterAdmin(ctx, 'contact_parent_search', {
      query,
      results: students.length,
      admin: ctx.from.first_name || 'Admin',
      adminId: ctx.from.id
    });

    await showSearchResults(ctx);

  } catch (error) {
    console.error('Error searching in contactParentAdminScene:', error);
    await ctx.reply('🛑 An error occurred while searching. Please try again.');
  }
});

async function showSearchResults(ctx) {
  const results = ctx.session.searchResults || [];
  const page = ctx.session.page || 1;
  const totalPages = Math.ceil(results.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageStudents = results.slice(start, start + PAGE_SIZE);

  const buttons = pageStudents.map((s) => [
    Markup.button.callback(`${s.name} (${s.studentId})`, `select_parent_${s.studentId}`)
  ]);

  const navButtons = [];
  if (page > 1) navButtons.push(Markup.button.callback('⬅️ Prev', 'page_prev'));
  if (page < totalPages) navButtons.push(Markup.button.callback('Next ➡️', 'page_next'));

  if (navButtons.length > 0) buttons.push(navButtons);
  buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_contact_parent')]);

  await ctx.reply(
    `👶 Students with linked parents (Page ${page}/${totalPages}):`,
    Markup.inlineKeyboard(buttons)
  );
}

contactParentAdminScene.action('page_prev', async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.session.page > 1) ctx.session.page--;
  await showSearchResults(ctx);
});

contactParentAdminScene.action('page_next', async (ctx) => {
  await ctx.answerCbQuery();
  const totalPages = Math.ceil((ctx.session.searchResults?.length || 0) / PAGE_SIZE);
  if (ctx.session.page < totalPages) ctx.session.page++;
  await showSearchResults(ctx);
});

contactParentAdminScene.action(/^select_parent_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  const studentId = ctx.match[1];

  try {
    const student = await getStudentById(studentId);
    if (!student || !student.parentId) {
      return ctx.reply('🛑 Student not found or no parent linked.');
    }

    const parent = await getUserById(student.parentId);
    if (!parent) {
      return ctx.reply('🛑 Parent user not found.');
    }

    ctx.session.recipientId = parent.telegramId;
    ctx.session.recipientName = parent.name;
    ctx.session.studentName = student.name;

    await logAdminAction(ctx, 'CONTACT_PARENT_SELECTED', {
      studentId: student.studentId,
      studentName: student.name,
      parentId: parent.telegramId,
      parentName: parent.name,
      adminId: ctx.from.id
    });

    await notifyMasterAdmin(ctx, 'contact_parent_selected', {
      studentId: student.studentId,
      studentName: student.name,
      parentId: parent.telegramId,
      parentName: parent.name,
      admin: ctx.from.first_name || 'Admin',
      adminId: ctx.from.id
    });

    await ctx.reply(
      `📬 You are now messaging <b>${parent.name}</b>, parent of <b>${student.name}</b>.\n\n` +
      '📤 Send any message (text, photo, video, document, audio, voice).',
      { parse_mode: 'HTML', reply_markup: Markup.keyboard([['🛑 Cancel']]).resize() }
    );

    return ctx.scene.enter('send_message_to_parent_admin_scene');

  } catch (error) {
    console.error('Error selecting parent in contactParentAdminScene:', error);
    await ctx.reply('🛑 An error occurred. Please try again.');
  }
});

contactParentAdminScene.action('cancel_contact_parent', async (ctx) => {
  await ctx.answerCbQuery();
  await logAdminAction(ctx, 'CONTACT_PARENT_CANCELLED', { adminId: ctx.from.id });
  await ctx.reply('🛑 Cancelled contacting parent.', adminMenu);
  return ctx.scene.leave();
});

stage.register(contactParentAdminScene);




const sendMessageToAdminScene = new Scenes.BaseScene('send_message_to_admin_scene');

sendMessageToAdminScene.hears('🛑 Cancel', async (ctx) => {
    ctx.session.recipientId = null;
    ctx.session.recipientName = null;
    await ctx.reply('🛑 Message cancelled.', adminMenu);
    return ctx.scene.leave();
});

sendMessageToAdminScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
    const recipientId = ctx.session.recipientId;
    if (!recipientId) {
        await ctx.reply('🛑 Recipient not set. Starting over.', adminMenu);
        return ctx.scene.leave();
    }

    const senderName = ctx.from.first_name || ctx.from.username || 'Admin';

    try {
        if (ctx.message.text) {
            const text = ctx.message.text.trim();
            await ctx.telegram.sendMessage(
                recipientId,
                `📢 Message from Admin ${senderName}:\n${text}`,
                { parse_mode: "HTML" }
            );
        } 
        else if (ctx.message.photo) {
            const photo = ctx.message.photo[ctx.message.photo.length - 1];
            const caption = ctx.message.caption
                ? `📢 Message from Admin ${senderName}:\n${ctx.message.caption}`
                : `📢 Message from Admin ${senderName}`;
            await ctx.telegram.sendPhoto(recipientId, photo.file_id, {
                caption,
                parse_mode: "HTML"
            });
        } 
        else if (ctx.message.video) {
            const caption = ctx.message.caption
                ? `📢 Message from Admin ${senderName}:\n${ctx.message.caption}`
                : `📢 Message from Admin ${senderName}`;
            await ctx.telegram.sendVideo(recipientId, ctx.message.video.file_id, {
                caption,
                parse_mode: "HTML"
            });
        } 
        else if (ctx.message.document) {
            const caption = ctx.message.caption
                ? `📢 Message from Admin ${senderName}:\n${ctx.message.caption}`
                : `📢 Message from Admin ${senderName}`;
            await ctx.telegram.sendDocument(recipientId, ctx.message.document.file_id, {
                caption,
                parse_mode: "HTML"
            });
        } 
        else if (ctx.message.audio) {
            const caption = ctx.message.caption
                ? `📢 Message from Admin ${senderName}:\n${ctx.message.caption}`
                : `📢 Message from Admin ${senderName}`;
            await ctx.telegram.sendAudio(recipientId, ctx.message.audio.file_id, {
                caption,
                parse_mode: "HTML"
            });
        } 
        else if (ctx.message.voice) {
            await ctx.telegram.sendVoice(recipientId, ctx.message.voice.file_id);
            await ctx.telegram.sendMessage(
                recipientId,
                `🗨️ Voice message from Admin ${senderName}`,
                { parse_mode: "HTML" }
            );
        }

        await ctx.reply('✅ Message sent successfully!', adminMenu);
    } catch (error) {
        if (error.response?.error_code === 403) {
            await ctx.reply(
                '🛑 Failed to send message. The admin may have blocked the bot.',
                adminMenu
            );
        } else {
            console.error('Error sending message to admin:', error);
            await ctx.reply('🛑 Failed to send message. Please try again later.', adminMenu);
        }
    } finally {
        ctx.session.recipientId = null;
        ctx.session.recipientName = null;
        ctx.scene.leave();
    }
});

sendMessageToAdminScene.on('message', (ctx) => {
    ctx.reply('⚠️ Unsupported content. Please send text, photo, video, document, audio, or voice.');
});
stage.register(contactParentAdminScene);
stage.register(sendMessageToAdminScene);

// --- Send Message to Parent (Admin) Scene ---
const sendMessageToParentAdminScene = new Scenes.BaseScene('send_message_to_parent_admin_scene');

sendMessageToParentAdminScene.enter((ctx) => {
  ctx.reply(
    '📤 You can now send a message to the parent.\n\n' +
    'Send text, photo, video, document, audio, or voice.\n\n' +
    '🛑 Press Cancel to stop.',
    Markup.keyboard([['🛑 Cancel']]).resize()
  );
});

sendMessageToParentAdminScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
  const parentId = ctx.session.recipientId;
  const parentName = ctx.session.recipientName;
  const studentName = ctx.session.studentName;
  const adminName = ctx.from.first_name || ctx.from.username || 'Admin';
  const adminId = ctx.from.id;

  if (!parentId) {
    ctx.reply('🛑 No parent selected. Please start again.', adminMenu);
    return ctx.scene.leave();
  }

  try {
    if (ctx.message.text) {
      const textToSend = `📢 Message from Admin (${adminName}):\n${ctx.message.text.trim()}`;
      await ctx.telegram.sendMessage(parentId, textToSend, { parse_mode: "HTML" });

      await logAdminAction(ctx, 'CONTACT_PARENT_MESSAGE_TEXT', {
        adminId,
        adminName,
        parentId,
        parentName,
        studentName,
        message: ctx.message.text.trim()
      });

      await notifyMasterAdmin(ctx, 'contact_parent_message_text', {
        admin: adminName,
        adminId,
        parentId,
        parentName,
        studentName,
        message: ctx.message.text.trim()
      });

    } else {
      let caption = `📢 Message from Admin\n\n` +
        `👨‍💼 Admin: ${adminName} (ID: ${adminId})\n` +
        `👪 Parent: ${parentName} (ID: ${parentId})\n` +
        `🎓 Student: ${studentName}\n` +
        `📅 Date: ${new Date().toLocaleString()}`;

      if (ctx.message.caption) caption += `\n📝 Caption: ${ctx.message.caption}`;

      if (ctx.message.photo) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        await ctx.telegram.sendPhoto(parentId, photo.file_id, { caption, parse_mode: "HTML" });
        await ctx.telegram.sendPhoto(process.env.MASTER_ADMIN_ID, photo.file_id, { caption, parse_mode: "HTML" });

      } else if (ctx.message.video) {
        await ctx.telegram.sendVideo(parentId, ctx.message.video.file_id, { caption, parse_mode: "HTML" });
        await ctx.telegram.sendVideo(process.env.MASTER_ADMIN_ID, ctx.message.video.file_id, { caption, parse_mode: "HTML" });

      } else if (ctx.message.document) {
        await ctx.telegram.sendDocument(parentId, ctx.message.document.file_id, { caption, parse_mode: "HTML" });
        await ctx.telegram.sendDocument(process.env.MASTER_ADMIN_ID, ctx.message.document.file_id, { caption, parse_mode: "HTML" });

      } else if (ctx.message.audio) {
        await ctx.telegram.sendAudio(parentId, ctx.message.audio.file_id, { caption, parse_mode: "HTML" });
        await ctx.telegram.sendAudio(process.env.MASTER_ADMIN_ID, ctx.message.audio.file_id, { caption, parse_mode: "HTML" });

      } else if (ctx.message.voice) {
        await ctx.telegram.sendVoice(parentId, ctx.message.voice.file_id, { caption, parse_mode: "HTML" });
        await ctx.telegram.sendVoice(process.env.MASTER_ADMIN_ID, ctx.message.voice.file_id, { caption, parse_mode: "HTML" });
      }

      await logAdminAction(ctx, 'CONTACT_PARENT_MESSAGE_MEDIA', {
        adminId,
        adminName,
        parentId,
        parentName,
        studentName,
        mediaType: Object.keys(ctx.message).find(k =>
          ['photo', 'video', 'document', 'audio', 'voice'].includes(k)
        ),
        hasCaption: !!ctx.message.caption
      });
    }

    ctx.reply('✅ Message sent to the parent.', adminMenu);

  } catch (error) {
    if (error.response && error.response.error_code === 403) {
      ctx.reply('🛑 Cannot send message, the parent may have blocked the bot.');
    } else {
      console.error('Error sending parent message:', error);
      ctx.reply('🛑 An error occurred while sending the message.');
    }
  } finally {
    ctx.session.recipientId = null;
    ctx.session.recipientName = null;
    ctx.session.studentName = null;
    ctx.scene.leave();
  }
});

sendMessageToParentAdminScene.hears('🛑 Cancel', async (ctx) => {
  await logAdminAction(ctx, 'CONTACT_PARENT_CANCELLED', { adminId: ctx.from.id });
  await ctx.reply('🛑 Cancelled contacting parent.', adminMenu);
  return ctx.scene.leave();
});

stage.register(sendMessageToParentAdminScene);

stage.register(contactParentAdminScene);


//contact teachers scene

const contactTeacherScene = new Scenes.BaseScene('contact_teacher_scene');

contactTeacherScene.enter(async (ctx) => {
  try {
    const teachers = await Teacher.find().sort({ name: 1 });
    if (teachers.length === 0) {
      ctx.reply('🛑 No teachers found.');
      return ctx.scene.leave();
    }
    const teacherButtons = teachers.map((teacher) =>
      [Markup.button.callback(`${teacher.name} (ID: ${teacher.teacherId})`, `select_contact_teacher_${teacher.teacherId}`)]
    );
    teacherButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_contact_teacher')]);
    ctx.reply('🧑🏫 Select a teacher to contact:', Markup.inlineKeyboard(teacherButtons));
  } catch (error) {
    console.error('Error fetching teachers in contactTeacherScene:', error);
    ctx.reply('🛑 An error occurred. Please try again later.');
    ctx.scene.leave();
  }
});

contactTeacherScene.action(/^select_contact_teacher_(.+)$/, async (ctx) => {
  const teacherId = ctx.match[1];
  await ctx.answerCbQuery();
  ctx.session.contactTeacherId = teacherId;
  ctx.reply('📝 Please send the message or media you want to send to the teacher.');
  ctx.scene.enter('send_contact_teacher_message_scene');
});

contactTeacherScene.action('cancel_contact_teacher', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply('🛑 Contact cancelled.', adminMenu);
  ctx.scene.leave();
});

const sendContactTeacherMessageScene = new Scenes.BaseScene('send_contact_teacher_message_scene');

sendContactTeacherMessageScene.enter((ctx) => {
  ctx.reply(
    '✉️ You can now type your message (or send photo/video/document/audio/voice) to the selected teacher.\n\n' +
    'Press 🛑 Cancel anytime to stop.',
    Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
  );
});

sendContactTeacherMessageScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
  const teacherId = ctx.session.contactTeacherId;
  if (!teacherId) {
    ctx.reply('🛑 No teacher selected. Please start again.');
    return ctx.scene.leave();
  }

  if (ctx.message.text && ctx.message.text.trim() === '🛑 Cancel') {
    ctx.reply('🛑 Contact cancelled. Returning to admin menu.', adminMenu);
    ctx.session.contactTeacherId = null;
    return ctx.scene.leave();
  }

  try {
    const teacher = await getTeacherById(teacherId);
    if (!teacher || !teacher.telegramId) {
      ctx.reply('🛑 Teacher not found or not linked with Telegram.');
      return ctx.scene.leave();
    }

    const adminId = ctx.from.id;
    const adminName = ctx.from.first_name || ctx.from.username || 'Admin';
    let sentMessageType = 'text';
    let sentPreview = '';

    if (ctx.message.text) {
      sentPreview = ctx.message.text.trim().slice(0, 100);
      const textToSend = `📢 Message from Admin (${adminName}):\n${ctx.message.text.trim()}`;
      await ctx.telegram.sendMessage(teacher.telegramId, textToSend, { parse_mode: "HTML" });
    } else if (ctx.message.photo) {
      sentMessageType = 'photo';
      sentPreview = ctx.message.caption || '[Photo sent]';
      const highestResPhoto = ctx.message.photo[ctx.message.photo.length - 1];
      const caption = ctx.message.caption 
        ? `📢 Message from Admin (${adminName}):\n${ctx.message.caption}` 
        : `📢 Message from Admin (${adminName})`;
      await ctx.telegram.sendPhoto(teacher.telegramId, highestResPhoto.file_id, { caption, parse_mode: "HTML" });
    } else if (ctx.message.video) {
      sentMessageType = 'video';
      sentPreview = ctx.message.caption || '[Video sent]';
      const caption = ctx.message.caption 
        ? `📢 Message from Admin (${adminName}):\n${ctx.message.caption}` 
        : `📢 Message from Admin (${adminName})`;
      await ctx.telegram.sendVideo(teacher.telegramId, ctx.message.video.file_id, { caption, parse_mode: "HTML" });
    } else if (ctx.message.document) {
      sentMessageType = 'document';
      sentPreview = ctx.message.caption || '[Document sent]';
      const caption = ctx.message.caption 
        ? `📢 Message from Admin (${adminName}):\n${ctx.message.caption}` 
        : `📢 Message from Admin (${adminName})`;
      await ctx.telegram.sendDocument(teacher.telegramId, ctx.message.document.file_id, { caption, parse_mode: "HTML" });
    } else if (ctx.message.audio) {
      sentMessageType = 'audio';
      sentPreview = ctx.message.caption || '[Audio sent]';
      const caption = ctx.message.caption 
        ? `📢 Message from Admin (${adminName}):\n${ctx.message.caption}` 
        : `📢 Message from Admin (${adminName})`;
      await ctx.telegram.sendAudio(teacher.telegramId, ctx.message.audio.file_id, { caption, parse_mode: "HTML" });
    } else if (ctx.message.voice) {
      sentMessageType = 'voice';
      sentPreview = ctx.message.caption || '[Voice message sent]';
      const caption = ctx.message.caption 
        ? `📢 Message from Admin (${adminName}):\n${ctx.message.caption}` 
        : `📢 Message from Admin (${adminName})`;
      await ctx.telegram.sendVoice(teacher.telegramId, ctx.message.voice.file_id, { caption, parse_mode: "HTML" });
    } else {
      ctx.reply('🛑 Unsupported message type. Please send text, photo, video, document, audio, or voice.');
      return;
    }

    ctx.reply('✅ Message sent to the teacher.', adminMenu);


    await logAdminAction(ctx, 'CONTACT_TEACHER', {
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      adminId,
      adminName,
      messageType: sentMessageType,
      messagePreview: sentPreview,
      date: new Date().toISOString()
    });

    if (adminId.toString() !== process.env.MASTER_ADMIN_ID) {
      await notifyMasterAdmin(ctx, 'contact_teacher', {
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        adminId,
        adminName,
        messageType: sentMessageType,
        messagePreview: sentPreview,
        date: new Date().toLocaleString()
      });
    }
    return ctx.scene.leave();

  } catch (error) {
    if (error.response && error.response.error_code === 403) {
      ctx.reply('🛑 Cannot send message, the teacher may have blocked the bot.');
    } else {
      console.error('Error sending contact teacher message:', error);
      ctx.reply('🛑 An error occurred while sending the message.');
    }
  }
});

sendContactTeacherMessageScene.on('message', (ctx) => {
  ctx.reply('🛑 Please send text, photo, video, document, audio, or voice — or press 🛑 Cancel.');
});

stage.register(contactTeacherScene);
stage.register(sendContactTeacherMessageScene);

/// Remove Teacher Scene 
const removeTeacherScene = new Scenes.BaseScene('remove_teacher_scene');

removeTeacherScene.enter(async (ctx) => {
    try {
        const teachers = await Teacher.find().sort({ name: 1 });
        
        if (teachers.length === 0) {
            ctx.reply('🛑 No teachers found to remove.', {
                reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
            });
            return ctx.scene.leave();
        }
        
        const teacherButtons = teachers.map(teacher => 
            [Markup.button.callback(
                `${teacher.name} (ID: ${teacher.teacherId})`, 
                `remove_teacher_${teacher.teacherId}`
            )]
        );
        
        teacherButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_remove_teacher')]);
        
        ctx.reply('🧑🏫 Select a teacher to remove:', Markup.inlineKeyboard(teacherButtons));
    } catch (error) {
        console.error('Error retrieving teachers for removal:', error);
        ctx.reply('🛑 An error occurred while retrieving teachers.', {
            reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
        });
        ctx.scene.leave();
    }
});

removeTeacherScene.action(/^remove_teacher_(.+)$/, async (ctx) => {
    const teacherId = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const teacher = await getTeacherById(teacherId);
        if (!teacher) {
            ctx.reply('🛑 Teacher not found.', {
                reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
            });
            return ctx.scene.leave();
        }
        
        ctx.session.teacherToRemove = teacher;
        
        const studentRelationsCount = await TeacherStudent.countDocuments({ teacherId });
        const gradesCount = await Grade.countDocuments({ teacherId });
        
        let userSchemaData = 0;
        if (teacher.telegramId) {
            const user = await getUserById(teacher.telegramId);
            if (user) {
                if (user.role === 'teacher') userSchemaData++;
                if (user.subjects && user.subjects.length > 0) userSchemaData++;
                if (user.adminId !== undefined && user.adminId !== null) userSchemaData++;
            }
        }
        
        ctx.replyWithHTML(
            `⚠️ Confirm Teacher Removal\n\n` +
            `Teacher Details:\n` +
            `• Name: ${teacher.name}\n` +
            `• ID: ${teacher.teacherId}\n` +
            `• Subjects: ${teacher.subjects.join(', ') || 'None'}\n` +
            `• Telegram ID: ${teacher.telegramId || 'Not linked'}\n\n` +
            `Associated Data:\n` +
            `• Student Relationships: ${studentRelationsCount}\n` +
            `• Grades Assigned: ${gradesCount}\n` +
            `• User Schema Data: ${userSchemaData} fields\n\n` +
            `This action will permanently delete:\n` +
            `• Teacher profile\n` +
            `• All student-teacher relationships\n` +
            `• All grades assigned by this teacher\n` +
            `• Teacher login credentials\n` +
            `• Teacher data in user schema\n\n` +
            `This action cannot be undone!\n\n` +
            `Are you sure you want to proceed?`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Yes, Remove Everything', `confirm_remove_${teacherId}`)],
                [Markup.button.callback('🛑 No, Cancel', 'cancel_remove_teacher')]
            ])
        );
    } catch (error) {
        console.error('Error in remove teacher scene:', error);
        ctx.reply('🛑 An error occurred.', {
            reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
        });
        ctx.scene.leave();
    }
});
removeTeacherScene.action(/^confirm_remove_(.+)$/, async (ctx) => {
    const teacherId = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const teacher = await getTeacherById(teacherId);
        if (!teacher) {
            ctx.reply('🛑 Teacher not found.', {
                reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
            });
            return ctx.scene.leave();
        }
        
        const teacherName = teacher.name;
        const teacherTelegramId = teacher.telegramId;
        
        let deletedRelations = 0;
        let deletedGrades = 0;
        let userSchemaCleaned = false;
        let userAccountHandled = false;
        
        try {
            const relationsResult = await TeacherStudent.deleteMany({ teacherId });
            deletedRelations = relationsResult.deletedCount;
            
            const gradesResult = await Grade.deleteMany({ teacherId });
            deletedGrades = gradesResult.deletedCount;
            
            await TeacherLogin.deleteOne({ teacherId });
            await Teacher.deleteOne({ teacherId });
            
            if (teacherTelegramId) {
                const user = await getUserById(teacherTelegramId);
                if (user) {
                    userAccountHandled = true;
                    
                    if (user.role === 'teacher') {
                        user.role = 'user'; 
                    }
                    
                    user.subjects = []; 
                    if (user.adminId !== undefined && user.adminId !== null) user.adminId = null;
                    if (user.teacherId !== undefined) user.teacherId = undefined;
                    
                    await user.save();
                    userSchemaCleaned = true;

                    // --- Notify teacher about account downgrade ---
                    try {
                        await ctx.telegram.sendMessage(
                            teacherTelegramId,
                            `⚠️ Your teacher account has been removed by an administrator.\n\n` +
                            `👨‍🏫 Teacher: ${teacherName}\n` +
                            `🆔 ID: ${teacherId}\n\n` +
                            `Your role is now "${user.role}". Contact support if you believe this is an error.`
                        );
                    } catch (notifyErr) {
                        console.warn(`Could not notify teacher ${teacherName} (${teacherTelegramId}):`, notifyErr.message);
                    }
                }
            }
            
            ctx.replyWithHTML(
                `✅ Teacher successfully removed!\n\n` +
                `🧑🏫 Teacher: ${teacherName}\n` +
                `🆔 ID: ${teacherId}\n\n` +
                `🗑️ Data Cleanup Summary:\n` +
                `• Student relationships removed: ${deletedRelations}\n` +
                `• Grades removed: ${deletedGrades}\n` +
                `• Login credentials removed: ✅\n` +
                `• Teacher profile removed: ✅\n` +
                `• User schema data cleaned: ${userSchemaCleaned ? '✅' : '🛑'}\n` +
                `• User account handled: ${userAccountHandled ? '✅' : 'N/A'}\n\n` +
                `All associated data has been permanently deleted or cleaned.`,
                {
                    reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
                }
            );

            await logAdminAction(ctx, 'REMOVE_TEACHER', {
                teacherId,
                teacherName,
                deletedRelations,
                deletedGrades,
                userSchemaCleaned,
                userAccountHandled,
                admin: ctx.from.first_name || ctx.from.username || 'Unknown',
                adminId: ctx.from.id,
                date: new Date().toISOString()
            });

            if (process.env.MASTER_ADMIN_ID) {
                await ctx.telegram.sendMessage(
                    process.env.MASTER_ADMIN_ID,
                    `🚨 <b>Admin Action Alert</b>\n\n` +
                    `👨‍💼 Admin: ${ctx.from.first_name || ctx.from.username} (ID: <code>${ctx.from.id}</code>)\n` +
                    `🗑️ Action: Teacher Removed\n\n` +
                    `🧑🏫 Teacher: ${teacherName} (ID: ${teacherId})\n` +
                    `📊 Cleanup:\n` +
                    `• Student relationships: ${deletedRelations}\n` +
                    `• Grades: ${deletedGrades}\n` +
                    `• Schema cleaned: ${userSchemaCleaned ? '✅' : '🛑'}\n` +
                    `• User handled: ${userAccountHandled ? '✅' : 'N/A'}\n\n` +
                    `🕒 Date: ${new Date().toLocaleString()}`,
                    { parse_mode: 'HTML' }
                );
            }
            
        } catch (cleanupError) {
            console.error('Error during teacher data cleanup:', cleanupError);

            await logAdminAction(ctx, 'REMOVE_TEACHER_ERROR', {
                teacherId,
                teacherName,
                error: cleanupError.message,
                admin: ctx.from.first_name || ctx.from.username || 'Unknown',
                adminId: ctx.from.id,
                date: new Date().toISOString()
            });

            ctx.reply(
                `⚠️ Partial Removal Completed\n\n` +
                `Teacher ${teacherName} was removed, but some data cleanup failed. ` +
                `Please contact system administrator to verify complete removal.\n\n` +
                `Cleanup status:\n` +
                `• Teacher profile: ✅\n` +
                `• User schema: ${userSchemaCleaned ? '✅' : '🛑'}\n` +
                `• Error: ${cleanupError.message}`,
                {
                    reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
                }
            );
        }
        
    } catch (error) {
        console.error('Error removing teacher:', error);

        await logAdminAction(ctx, 'REMOVE_TEACHER_FATAL_ERROR', {
            teacherId,
            error: error.message,
            admin: ctx.from.first_name || ctx.from.username || 'Unknown',
            adminId: ctx.from.id,
            date: new Date().toISOString()
        });

        ctx.reply('🛑 An error occurred while removing the teacher.', {
            reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
        });
    }
    
    delete ctx.session.teacherToRemove;
    ctx.scene.leave();
});


removeTeacherScene.action('cancel_remove_teacher', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Teacher removal cancelled.', {
        reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
    });
    
    delete ctx.session.teacherToRemove;
    ctx.scene.leave();
});

stage.register(removeTeacherScene);

//VIEW STUDENT BY CLASS SCENE
const viewStudentsByGradeScene = new Scenes.BaseScene('view_students_by_grade_scene');

viewStudentsByGradeScene.enter(async (ctx) => {
    try {
        const availableClasses = await getUniqueClasses();
        
        if (availableClasses.length === 0) {
            ctx.reply('🛑 No classes found from uploaded lists. Please upload a student list first.');
            return ctx.scene.leave();
        }
        
        const classButtons = availableClasses.map(className => 
            [Markup.button.callback(
                className, 
                `view_class_${className.replace(/\s+/g, '_')}`
            )]
        );
        
        classButtons.push([Markup.button.callback('Cancel', 'cancel_view_students')]);
        
        ctx.reply('🎓 Select a class to view students:', Markup.inlineKeyboard(classButtons));
    } catch (error) {
        console.error('Error retrieving classes:', error);
        ctx.reply('🛑 An error occurred while retrieving classes.');
        ctx.scene.leave();
    }
});

viewStudentsByGradeScene.action(/^view_class_(.+)$/, async (ctx) => {
    const className = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();
    
    try {
        const students = await Student.find({ class: className }).sort({ name: 1 });
        
        if (students.length === 0) {
            ctx.reply(`🛑 No students found in "${className}".`);
            return ctx.scene.leave();
        }
        
        const studentPromises = students.map(async (student) => {
            let parentInfo = {
                telegramId: 'Not linked',
                username: 'N/A',
                name: 'N/A'
            };
            
            if (student.parentId) {
                const parentUser = await getUserById(student.parentId);
                if (parentUser) {
                    parentInfo = {
                        telegramId: parentUser.telegramId,
                        username: parentUser.username || 'N/A',
                        name: parentUser.name || 'N/A'
                    };
                } else {
                    parentInfo = {
                        telegramId: student.parentId,
                        username: 'Not found',
                        name: 'Not found'
                    };
                }
            }
            
            return { 
                ...student.toObject(), 
                parentInfo 
            };
        });
        
        const studentsWithParentInfo = await Promise.all(studentPromises);
        
        const maxNameLength = Math.max(...studentsWithParentInfo.map(s => s.name.length), 10);
        const maxParentNameLength = Math.max(...studentsWithParentInfo.map(s => s.parentInfo.name.length), 8);
        
        let fileContent = `DETAILED STUDENT LIST - ${className.toUpperCase()}\n`;
        fileContent += '='.repeat(120) + '\n';
        fileContent += `${'STUDENT NAME'.padEnd(maxNameLength)} - STUDENT ID - ${'PARENT NAME'.padEnd(maxParentNameLength)} - TELEGRAM ID - TELEGRAM USERNAME\n`;
        fileContent += '-'.repeat(maxNameLength) + ' - ' + '-'.repeat(10) + ' - ' + 
                      '-'.repeat(maxParentNameLength) + ' - ' + '-'.repeat(10) + ' - ' + '-'.repeat(15) + '\n';
        
        studentsWithParentInfo.forEach(student => {
            const paddedStudentName = student.name.padEnd(maxNameLength);
            const paddedParentName = student.parentInfo.name.padEnd(maxParentNameLength);
            
            fileContent += `${paddedStudentName} - ${student.studentId} - ${paddedParentName} - ${student.parentInfo.telegramId} - ${student.parentInfo.username}\n`;
        });
        
        fileContent += `\nTotal: ${studentsWithParentInfo.length} students\n`;
        fileContent += `Generated on: ${new Date().toLocaleString()}\n`;
        fileContent += 'Generated by School System';
        
        const tempDir = './temp_exports';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const filename = `students_detailed_${className.replace(/\s+/g, '_')}_${Date.now()}.txt`;
        const tempPath = path.join(tempDir, filename);
        fs.writeFileSync(tempPath, fileContent);
        
        await ctx.replyWithDocument({
            source: tempPath,
            filename: filename,
            caption: `📋 Detailed student list for ${className} (${studentsWithParentInfo.length} students)`
        });
        
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        
    } catch (error) {
        console.error('Error viewing students:', error);
        ctx.reply('🛑 An error occurred while retrieving students.');
    }
});

viewStudentsByGradeScene.action('cancel_view_students', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('View students cancelled.', {
        reply_markup: { keyboard: studentManagementMenu.reply_markup.keyboard, resize_keyboard: true }
    });
    ctx.scene.leave();
});

stage.register(viewStudentsByGradeScene);


// --- Edit Student Scene ---
const editStudentScene = new Scenes.BaseScene('edit_student_scene');

editStudentScene.enter(async (ctx) => {
    try {
        
        await notifyMasterAdmin(ctx, 'edit_student_initiated', {
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id
        });
        
        const cancelKeyboard = Markup.keyboard([
            ['🛑 Cancel']
        ]).oneTime().resize();
        
        await ctx.reply(
            '✏️ Enter the Student ID (format: STXXXX) to edit:',
            cancelKeyboard
        );
    } catch (error) {
        console.error('Error entering edit student scene:', error);
        await notifyMasterAdmin(ctx, 'edit_student_error', { 
            error: error.message,
            adminId: ctx.from.id
        });
        await ctx.reply('🛑 An error occurred.', adminMenu);
        await ctx.scene.leave();
    }
});

editStudentScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim();
    
    if (input === '🛑 Cancel') {
        await notifyMasterAdmin(ctx, 'edit_student_cancelled', { 
            admin: ctx.from.first_name || 'Admin',
            adminId: ctx.from.id
        });
        await ctx.reply('🛑 Student edit cancelled.', adminMenu);
        delete ctx.session.studentToEdit;
        return ctx.scene.leave();
    }
    
    if (!ctx.session.studentToEdit) {
        if (!isValidStudentId(input)) {
            return ctx.reply('🛑 Invalid Student ID format. Please enter a valid ID (e.g., ST1234) or select "🛑 Cancel".');
        }
        
        try {
            const student = await getStudentById(input);
            if (!student) {
                await ctx.reply('🛑 Student not found with this ID.', adminMenu);
                return ctx.scene.leave();
            }
            
            ctx.session.studentToEdit = {
                studentId: student.studentId,
                step: 'select_field'
            };
            
            const parent = student.parentId ? await getUserById(student.parentId) : null;
            let studentInfo = `✏️ EDIT STUDENT\n\n` +
                `👤 Name: ${student.name}\n` +
                `🆔 ID: <code>${student.studentId}</code>\n` +
                `🏫 Class: ${student.class}\n` +
                `👪 Parent: ${parent ? parent.name : 'None'}\n\n` +
                `Please select a field to edit:`;
            
            const editKeyboard = Markup.keyboard([
                ['✏️ Edit Name', '🛑 Cancel']
            ]).oneTime().resize();
            
            await ctx.replyWithHTML(studentInfo, editKeyboard);
        } catch (error) {
            console.error('Error preparing student edit:', error);
            
            await notifyMasterAdmin(ctx, 'edit_student_preparation_error', { 
                studentId: input,
                error: error.message,
                adminId: ctx.from.id
            });
            await ctx.reply('🛑 An error occurred.', adminMenu);
            delete ctx.session.studentToEdit;
            await ctx.scene.leave();
        }
    } else {
        const { studentId, step } = ctx.session.studentToEdit;
        
        if (step === 'select_field') {
            if (!['✏️ Edit Name', '🏫 Edit Class', '👪 Edit Parent'].includes(input)) {
                return ctx.reply('🛑 Please select a valid option or "🛑 Cancel".');
            }
            
            try {
                const cancelKeyboard = Markup.keyboard([
                    ['🛑 Cancel']
                ]).oneTime().resize();
                
                if (input === '✏️ Edit Name') {
                    ctx.session.studentToEdit.step = 'edit_name';
                    await ctx.reply('Enter the new name for the student:', cancelKeyboard);
                } else if (input === '🏫 Edit Class') {
                    ctx.session.studentToEdit.step = 'edit_class';
                    await ctx.reply('Enter the new class for the student:', cancelKeyboard);
                } else if (input === '👪 Edit Parent') {
                    ctx.session.studentToEdit.step = 'edit_parent';
                    await ctx.reply('Enter the Telegram ID of the new parent (or "None" to unlink):', cancelKeyboard);
                }
            } catch (error) {
                console.error('Error selecting field to edit:', error);
                
                await notifyMasterAdmin(ctx, 'edit_student_field_selection_error', { 
                    studentId,
                    error: error.message,
                    adminId: ctx.from.id
                });
                await ctx.reply('🛑 An error occurred.', adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            }
        } else if (step === 'edit_name') {
            if (!input || input.length < 2) {
                return ctx.reply('🛑 Name must be at least 2 characters long. Please try again or select "🛑 Cancel".');
            }
            
            try {
                const student = await getStudentById(studentId);
                if (!student) {
                    await ctx.reply('🛑 Student not found.', adminMenu);
                    delete ctx.session.studentToEdit;
                    return ctx.scene.leave();
                }
                
                const oldName = student.name;
                student.name = input;
                await student.save();
                
                
                await notifyMasterAdmin(ctx, 'student_name_updated', {
                    studentId,
                    oldName,
                    newName: input,
                    admin: ctx.from.first_name || 'Admin',
                    adminId: ctx.from.id
                });
                

        await logAdminAction(ctx, 'EDIT_STUDENT_NAME', {
            studentId,
            oldName,
            newName: input
        });
                await ctx.reply(`✅ Student name updated to "${input}".`, adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            } catch (error) {
                console.error('Error updating student name:', error);
                
                await notifyMasterAdmin(ctx, 'edit_student_name_error', { 
                    studentId,
                    error: error.message,
                    adminId: ctx.from.id
                });
                await ctx.reply('🛑 An error occurred.', adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            }
        } else if (step === 'edit_class') {
            if (!input || input.length < 1) {
                return ctx.reply('🛑 Class name cannot be empty. Please try again or select "🛑 Cancel".');
            }
            
            try {
                const student = await getStudentById(studentId);
                if (!student) {
                    await ctx.reply('🛑 Student not found.', adminMenu);
                    delete ctx.session.studentToEdit;
                    return ctx.scene.leave();
                }
                
                const oldClass = student.class;
                student.class = input;
                await student.save();
                
                
                await notifyMasterAdmin(ctx, 'student_class_updated', {
                    studentId,
                    oldClass,
                    newClass: input,
                    admin: ctx.from.first_name || 'Admin',
                    adminId: ctx.from.id
                });
                
                await ctx.reply(`✅ Student class updated to "${input}".`, adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            } catch (error) {
                console.error('Error updating student class:', error);
                
                await notifyMasterAdmin(ctx, 'edit_student_class_error', { 
                    studentId,
                    error: error.message,
                    adminId: ctx.from.id
                });
                await ctx.reply('🛑 An error occurred.', adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            }
        } else if (step === 'edit_parent') {
            try {
                const student = await getStudentById(studentId);
                if (!student) {
                    await ctx.reply('🛑 Student not found.', adminMenu);
                    delete ctx.session.studentToEdit;
                    return ctx.scene.leave();
                }
                
                let parentUpdateMsg = '';
                let oldParentId = student.parentId;
                let oldParentName = null;
                
                if (oldParentId) {
                    const oldParent = await getUserById(oldParentId);
                    oldParentName = oldParent ? oldParent.name : 'Unknown';
                }
                
                if (input.toLowerCase() === 'none') {
                    if (student.parentId) {
                        const parent = await getUserById(student.parentId);
                        if (parent) {
                            parent.studentIds = parent.studentIds.filter(id => id !== studentId);
                            if (parent.studentIds.length === 0) {
                                parent.role = 'user';
                                
                            }
                            await parent.save();
                            
                        }
                        student.parentId = null;
                        await student.save();
                        parentUpdateMsg = 'Parent unlinked successfully.';
                    } else {
                        parentUpdateMsg = 'No parent was linked to this student.';
                    }
                } else {
                    const newParent = await getUserById(input);
                    if (!newParent) {
                        return ctx.reply('🛑 Parent with this Telegram ID not found. Please try again or select "🛑 Cancel".');
                    }
                    
                    if (student.parentId && student.parentId !== input) {
                        const oldParent = await getUserById(student.parentId);
                        if (oldParent) {
                            oldParent.studentIds = oldParent.studentIds.filter(id => id !== studentId);
                            if (oldParent.studentIds.length === 0) {
                                oldParent.role = 'user';
                              
                            }
                            await oldParent.save();
                            
                        }
                    }
                    
                    newParent.studentIds = newParent.studentIds || [];
                    if (!newParent.studentIds.includes(studentId)) {
                        newParent.studentIds.push(studentId);
                    }
                    newParent.role = 'parent';
                    await newParent.save();
                    student.parentId = input;
                    await student.save();
                    parentUpdateMsg = `Parent updated to ${newParent.name}.`;
                }
                
                await notifyMasterAdmin(ctx, 'student_parent_updated', {
                    studentId,
                    studentName: student.name,
                    oldParentId,
                    oldParentName,
                    newParentId: input.toLowerCase() === 'none' ? null : input,
                    newParentName: input.toLowerCase() === 'none' ? null : (await getUserById(input))?.name,
                    admin: ctx.from.first_name || 'Admin',
                    adminId: ctx.from.id
                });
                
                await ctx.reply(`✅ ${parentUpdateMsg}`, adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            } catch (error) {
                console.error('Error updating student parent:', error);
                
                await notifyMasterAdmin(ctx, 'edit_student_parent_error', { 
                    studentId,
                    error: error.message,
                    adminId: ctx.from.id
                });
                await ctx.reply('🛑 An error occurred.', adminMenu);
                delete ctx.session.studentToEdit;
                await ctx.scene.leave();
            }
        }
    }
});

stage.register(editStudentScene);


// Add Student Scene
const addStudentScene = new Scenes.BaseScene('add_student_scene');

addStudentScene.enter(async (ctx) => {
    await ctx.reply(
        '📝 Please provide the student\'s full name.',
        Markup.keyboard([['🛑 Cancel']]).resize().oneTime()
    );
});

addStudentScene.on('text', async (ctx) => {
    const studentName = ctx.message.text.trim();

    // 🚫 Handle cancel
    if (studentName === '🛑 Cancel') {
        await ctx.reply('✅ Student addition cancelled.', Markup.removeKeyboard());
        await ctx.reply('Returning to admin menu...', adminMenu);
        return ctx.scene.leave();
    }

    if (!isValidName(studentName)) {
        ctx.reply('🛑 Invalid name. Please provide a non-empty name (max 100 characters).');
        return;
    }
    
    ctx.session.newStudentName = studentName;
    
    const availableClasses = await getUniqueClasses();
    
    if (availableClasses.length === 0) {
        ctx.reply('No classes found. Please upload a student list first or enter the class name manually.');
        ctx.scene.enter('add_student_class_scene');
        return;
    }
    
    const classButtons = availableClasses.map(className => 
        [Markup.button.callback(className, `select_class_${className}`)]
    );
    
    ctx.reply('Please select the class for this student:', Markup.inlineKeyboard(classButtons));
});

addStudentScene.action(/^select_class_(.+)$/, async (ctx) => {
    const className = ctx.match[1];
    await ctx.answerCbQuery();
    
    const studentName = ctx.session.newStudentName;
    if (!isValidClassName(className) || !isValidName(studentName)) {
        ctx.reply('🛑 Invalid input. Please ensure name and class are valid.');
        ctx.session.newStudentName = null;
        return ctx.scene.leave();
    }
    
    const studentId = await generateUniqueStudentId();
    const newStudent = new Student({
        studentId,
        name: studentName,
        class: className,
        parentId: null,
        grades: {},
    });
    
    try {
        await newStudent.save();

        await logAdminAction(ctx, 'ADD_STUDENT', {
            studentId,
            studentName,
            class: className,
            addedBy: ctx.from.id,
            addedByName: ctx.from.first_name
        });

        ctx.replyWithHTML(
            `✅ Student "<b>${studentName}</b>" added to class "<b>${className}</b>"\n` +
            `🆔 Unique ID: <code>${studentId}</code>\n\n` +
            `📢 Share this ID with the parent for registration.`
        );
    } catch (error) {
        console.error('Error saving student:', error);
        ctx.reply('🛑 Failed to add student. Please try again.');
    }
    
    ctx.session.newStudentName = null;
    ctx.scene.leave();
});

stage.register(addStudentScene);



const addStudentClassScene = new Scenes.BaseScene('add_student_class_scene');
addStudentClassScene.enter((ctx) => {
    ctx.reply('Please enter the student\'s class (e.g., Grade 5, Grade 8, Grade 10).');
});

addStudentClassScene.on('text', async (ctx) => {
    const studentClass = ctx.message.text.trim();
    const studentName = ctx.session.newStudentName;
    
    if (!isValidClassName(studentClass) || !isValidName(studentName)) {
        ctx.reply('🛑 Invalid input. Please ensure name and class are valid.');
        ctx.session.newStudentName = null;
        return ctx.scene.leave();
    }
    
    const studentId = await generateUniqueStudentId();
    const newStudent = new Student({
        studentId,
        name: studentName,
        class: studentClass,
        parentId: null,
        grades: {}
    });
    
    try {
        await newStudent.save();
        ctx.replyWithHTML(`✅ Student "${studentName}" added to class "${studentClass}" with unique ID: ${studentId}
Share this ID with the parent for registration.`);
    } catch (error) {
        console.error('Error saving student:', error);
        ctx.reply('🛑 Failed to add student. Please try again.');
    }
    
    ctx.session.newStudentName = null;
    ctx.scene.leave();
});

stage.register(addStudentClassScene);

///////////////////////////////////////// upload student list scene
const uploadStudentListScene = new Scenes.BaseScene('upload_student_list_scene');

const parseStudentNames = (content) => {
  return content
    .split(/\r?\n/)
    .map(name => name.trim())
    .filter(name => {
      if (!name) return false;
      name = name.replace(/^\uFEFF/, ''); // Remove BOM
      const nameRegex = /^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s.'-]{2,50}$/;
      return nameRegex.test(name);
    })
    .map(name => {
      return name.replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    });
};

const processStudentFile = async (ctx, tempUploadPath, className, uploadedFileMeta) => {
  const MAX_RETRIES = 3;
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const fileContent = fs.readFileSync(tempUploadPath, 'utf8');
      const studentNames = parseStudentNames(fileContent);

      if (studentNames.length === 0) {
        return { success: false, error: 'No valid names found' };
      }

      const total = studentNames.length;
      const progressMsg = await ctx.reply(`⏳ Processing ${total} students, Please wait...`);

      const students = [];
      let processed = 0;
      const updateInterval = Math.max(1, Math.floor(total / 10));

      for (const name of studentNames) {
        students.push({
          studentId: await generateUniqueStudentId(),
          name,
          class: className,
          parentId: null
        });

        processed++;
        if (processed % updateInterval === 0 || processed === total) {
          const percent = Math.round((processed / total) * 100);
          try {
            await ctx.telegram.editMessageText(
              progressMsg.chat.id,
              progressMsg.message_id,
              null,
              `⏳ Processing ${total} students... (${percent}%)`
            );
          } catch (editError) {
          }
        }
      }

      let addedCount = 0, errorCount = 0;
      try {
        await Student.insertMany(students, { ordered: false });
        addedCount = students.length;
      } catch (err) {
        console.error('Bulk insert error:', err);
        if (err.writeErrors) {
          addedCount = students.length - err.writeErrors.length;
          errorCount = err.writeErrors.length;
        } else {
          errorCount = students.length;
        }
      }

      const savedUpload = await new UploadedFile({
        ...uploadedFileMeta,
        uploadDate: new Date(),
        processed: true,
        classAssigned: className
      }).save();

      await logAdminAction(ctx, 'UPLOAD_STUDENT_LIST', {
        fileName: savedUpload.originalName,
        fileId: savedUpload._id,
        class: className,
        totalStudents: total,
        added: addedCount,
        errors: errorCount
      });

      const masterId = process.env.MASTER_ADMIN_ID;
      if (masterId) {
        try {
          await ctx.telegram.sendMessage(
            masterId,
            `📤 <b>Student List Uploaded</b>\n\n` +
            `👤 By: ${ctx.from.first_name} (@${ctx.from.username || 'N/A'})\n` +
            `🆔 Telegram ID: ${ctx.from.id}\n\n` +
            `📚 Class: <b>${className}</b>\n` +
            `📄 File: <code>${savedUpload.originalName}</code>\n\n` +
            `✅ Added: ${addedCount}\n` +
            `⚠️ Errors: ${errorCount}\n` +
            `📅 Time: ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`,
            { parse_mode: 'HTML' }
          );
        } catch (notifyErr) {
          console.error("Failed to notify master admin:", notifyErr.message);
        }
      }

      await ctx.telegram.editMessageText(
        progressMsg.chat.id,
        progressMsg.message_id,
        null,
        `✅ Successfully finished uploading ${total} students.\n` +
        `📚 Class: ${className}\n` +
        `👥 Added: ${addedCount}, ⚠️ Errors: ${errorCount}`
      );

      return { success: true, addedCount, errorCount, total };
    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        console.error(`File processing failed after ${MAX_RETRIES} attempts:`, error);
        return { success: false, error: error.message };
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
};

const SCENE_TIMEOUT = 10 * 60 * 1000;

uploadStudentListScene.use((ctx, next) => {
  if (ctx.session.sceneEnterTime && Date.now() - ctx.session.sceneEnterTime > SCENE_TIMEOUT) {
    ctx.reply('⏰ Session timed out. Please start over.');
    return ctx.scene.leave();
  }

  return next();
});

uploadStudentListScene.enter((ctx) => {
  ctx.session.sceneEnterTime = Date.now();
  ctx.session.uploadData = {
    tempUploadPath: null,
    uploadedFileMeta: null,
    className: null
  };
  
  ctx.reply('📂 Please upload a text file with student names (one per line).');
});

uploadStudentListScene.on('document', async (ctx) => {
  try {
    const file = ctx.message.document;
    if (!file) {
      return ctx.reply('🛑 No file detected. Please upload again.');
    }

    

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.file_size > MAX_FILE_SIZE) {
      return ctx.reply('🛑 File too large. Maximum size is 5MB.');
    }

    if (!ctx.session.uploadData) {
      ctx.session.uploadData = {};
    }

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const tempDir = './temp_uploads';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const storedName = `${Date.now()}_${file.file_name}`;
    const tempUploadPath = path.join(tempDir, storedName);

    const response = await fetch(fileLink.href);
    const buffer = await response.buffer();
    fs.writeFileSync(tempUploadPath, buffer);

    ctx.session.uploadData.tempUploadPath = tempUploadPath;
    ctx.session.uploadData.uploadedFileMeta = {
      id: crypto.randomBytes(8).toString('hex'),
      originalName: file.file_name,
      storedName
    };

    ctx.reply('✅ File uploaded. Now enter the class name this list belongs to:');
  } catch (err) {
    console.error('File upload error:', err);
    ctx.reply('🛑 Failed to upload file. Try again.');
    
    if (ctx.session.uploadData?.tempUploadPath && fs.existsSync(ctx.session.uploadData.tempUploadPath)) {
      fs.unlinkSync(ctx.session.uploadData.tempUploadPath);
    }
    delete ctx.session.uploadData;
    ctx.scene.leave();
  }
});

uploadStudentListScene.on('text', async (ctx) => {
  const className = ctx.message.text.trim();
  if (!isValidClassName(className)) {
    return ctx.reply('🛑 Invalid class name. Max 50 characters.');
  }

  const { uploadData } = ctx.session;
  if (!uploadData?.tempUploadPath || !uploadData?.uploadedFileMeta) {
    ctx.reply('🛑 Session error. Please upload the file again.');
    return ctx.scene.leave();
  }

  const { tempUploadPath, uploadedFileMeta } = uploadData;

  try {
    if (!fs.existsSync(tempUploadPath)) {
      ctx.reply('🛑 Temporary file not found. Please upload again.');
      return ctx.scene.leave();
    }

    const result = await processStudentFile(ctx, tempUploadPath, className, uploadedFileMeta);
    
    if (!result.success) {
      ctx.reply(`🛑 Processing failed: ${result.error}`);
    }

  } catch (error) {
    console.error('File processing error:', error);
    ctx.reply('🛑 An error occurred while processing the file.');
  } finally {
    if (tempUploadPath && fs.existsSync(tempUploadPath)) {
      fs.unlinkSync(tempUploadPath);
    }
    delete ctx.session.uploadData;
    ctx.scene.leave();
  }
});

uploadStudentListScene.leave((ctx) => {
  if (ctx.session.uploadData?.tempUploadPath && fs.existsSync(ctx.session.uploadData.tempUploadPath)) {
    fs.unlinkSync(ctx.session.uploadData.tempUploadPath);
  }
  delete ctx.session.uploadData;
  delete ctx.session.sceneEnterTime;
});

stage.register(uploadStudentListScene);





const registerParentScene = new Scenes.BaseScene('register_parent_scene');

registerParentScene.enter(async (ctx) => {
  try {
    const existingUser = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (existingUser && (existingUser.role === 'parent' || existingUser.role === 'parentAm')) {
      await ctx.reply(
        `👋 Welcome back, ${existingUser.name}! You are already registered as a Parent.`,
        { reply_markup: existingUser.role === 'parent' ? parentMenu.reply_markup : parentMenuAm.reply_markup }
      );
      return ctx.scene.leave();
    }

    await ctx.reply(
      '🏫 Welcome to Parent Registration!\n\n' +
      'Before we begin, please enter the *School Code* to verify your affiliation:',
      Markup.keyboard([['🛑 Cancel']]).resize()
    );
    ctx.scene.session.state = 'awaiting_school_code';
  } catch (err) {
    console.error('Error entering parent registration scene:', err);
    await ctx.reply('🛑 Failed to start parent registration. Please try again later.');
    ctx.scene.leave();
  }
});

registerParentScene.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (text === '🛑 Cancel') {
    await ctx.reply('🛑 Parent registration cancelled.', Markup.removeKeyboard());
    await ctx.reply('Returning to main menu.', { reply_markup: loginMenu.reply_markup });
    return ctx.scene.leave();
  }

  if (ctx.scene.session.state === 'awaiting_school_code') {
    if (text === process.env.SCHOOL_CODE) {
      await ctx.reply(
        '✅ School verified! Now, please enter your *Full Name*.',
        Markup.keyboard([['🛑 Cancel']]).resize()
      );
      ctx.scene.session.state = 'awaiting_parent_name';
    } else {
      await ctx.reply('🛑 Invalid School Code. Please check and re-enter.');
    }
    return;
  }

  if (ctx.scene.session.state === 'awaiting_parent_name') {
    if (!isValidName(text)) {
      await ctx.reply('🛑 Invalid name. Please enter a valid full name (1–100 characters).');
      return;
    }
    ctx.scene.session.parentName = text;
    await ctx.reply(
      `📋 Thank you, ${text}!\n\nPlease enter your child's 6-digit Student ID (e.g., ST0000).`,
      Markup.keyboard([['🛑 Cancel']]).resize()
    );
    ctx.scene.session.state = 'awaiting_student_id';
    return;
  }

  if (ctx.scene.session.state === 'awaiting_student_id') {
    const cleanId = text.toUpperCase().trim();

    if (!isValidStudentId(cleanId)) {
      await ctx.reply('🛑 Invalid Student ID format. Please enter a valid ID (e.g., ST0000).');
      return;
    }

    try {
      const student = await getStudentById(cleanId);
      if (!student) return ctx.reply('🛑 Student ID not found.');
      if (student.parentId) return ctx.reply('🛑 This student is already linked.');
      if (student.pendingParentId) return ctx.reply('🛑 This student already has a pending parent request.');

      const telegramId = ctx.from.id.toString();
      let parent = await User.findOne({ telegramId });

      if (!parent) {
        parent = new User({
          telegramId,
          username: ctx.from.username,
          name: ctx.scene.session.parentName,
          role: 'user'
        });
      } else {
        parent.name = ctx.scene.session.parentName;
      }

      parent.pendingStudentRequests = parent.pendingStudentRequests || [];
      parent.pendingStudentRequests.push({ studentId: cleanId, requestedAt: Date.now() });
      await parent.save();

      student.pendingParentId = telegramId;
      student.pendingParentAt = Date.now();
      await student.save();

      const admins = await getAdmins();
      const requestId = `${parent.telegramId}_${student.studentId}`;
      const sentMessages = [];

      const notificationMessage =
        `🔔 <b>NEW PARENT REGISTRATION REQUEST</b>\n\n` +
        `👤 Parent: <b>${parent.name}</b> (@${parent.username || 'N/A'})\n` +
        `🆔 TG ID: <code>${parent.telegramId}</code>\n\n` +
        `👶 Student: <b>${student.name}</b>\n` +
        `🔢 ID: <code>${student.studentId}</code>\n` +
        `🏫 Class: ${student.class || 'N/A'}\n\n` +
        `Please review and take action:`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Approve Link', `approve_parent_${parent.telegramId}_${student.studentId}`),
          Markup.button.callback('🛑 Deny Link', `deny_parent_${parent.telegramId}_${student.studentId}`)
        ]
      ]);

      for (const admin of admins) {
        try {
          const sent = await ctx.telegram.sendMessage(admin.telegramId, notificationMessage, {
            parse_mode: 'HTML',
            ...keyboard
          });
          sentMessages.push({ adminId: admin.telegramId, messageId: sent.message_id });
        } catch (error) {
          console.error(`Failed to notify admin ${admin.telegramId}:`, error);
        }
      }

      if (sentMessages.length > 0) {
        await ApprovalMessage.create({
          type: 'parent',
          requestId,
          messages: sentMessages,
          createdAt: new Date()
        });
      }

      await ctx.reply(
        `🎉 Request submitted successfully!\n\nWe received your request to link to ${student.name} (${cleanId}).\n⏳ Waiting for admin approval.`,
        Markup.removeKeyboard()
      );
      await ctx.reply('Returning to main menu.', { reply_markup: loginMenu.reply_markup });
      ctx.scene.leave();

      setTimeout(async () => {
        try {
          const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
          if (!approval) return; // already handled

          const freshStudent = await Student.findOne({ studentId: cleanId });
          if (!freshStudent || freshStudent.parentId) return;

          if (freshStudent.pendingParentId === telegramId) {
            freshStudent.pendingParentId = null;
            freshStudent.pendingParentAt = null;
            await freshStudent.save();

            const freshParent = await User.findOne({ telegramId });
            if (freshParent) {
              freshParent.pendingStudentRequests = (freshParent.pendingStudentRequests || []).filter(r => r.studentId !== cleanId);
              await freshParent.save();
            }

            await ApprovalMessage.deleteOne({ _id: approval._id });

            const expiredText =
              `⌛ <b>Parent Link Request Expired</b>\n\n` +
              `👤 Parent: <b>${parent.name}</b> (${telegramId})\n` +
              `🎓 Student: <b>${student.name}</b> (${student.studentId})\n` +
              `📅 Requested: <b>${approval.createdAt.toLocaleString()}</b>\n\n` +
              `⚠️ No admin action was taken within 5 minutes.\n` +
              `The pending request has been automatically cleared.`;

            const master = await User.findOne({ role: 'masterAdmin' });
            if (master) {
              await ctx.telegram.sendMessage(master.telegramId, expiredText, { parse_mode: 'HTML' });
            }

            for (const admin of admins) {
              await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
            }

            await ctx.telegram.sendMessage(
              telegramId,
              `⚠️ Your link request for ${student.name} (${student.studentId}) expired after 5 minutes without review and has been cleared.`,
              { parse_mode: 'HTML' }
            );

          }
        } catch (err) {
          console.error('Error auto-clearing expired parent link:', err);
        }
      }, 5 * 60 * 1000); // ✅ 5 minutes

    } catch (error) {
      console.error('Parent registration error:', error);
      await ctx.reply('🛑 Internal error during registration.', Markup.removeKeyboard());
      ctx.scene.leave();
    }
  }
});

stage.register(registerParentScene);



//link another student scene
const linkAnotherStudentScene = new Scenes.BaseScene('link_another_student_scene');

linkAnotherStudentScene.enter((ctx) => {
  ctx.reply(
    '🔗 Link Another Student\n\n' +
    'Please enter the Student ID (e.g., ST1234) of the child you want to link:',
    Markup.keyboard([['🛑 Cancel']]).resize()
  );
});

linkAnotherStudentScene.on('text', async (ctx) => {
  const input = ctx.message.text.trim().toUpperCase();

  if (input === '🛑 CANCEL') {
    await ctx.reply('🛑 Linking student cancelled.', parentMenu);
    return ctx.scene.leave();
  }

  if (!/^ST\d+$/.test(input)) {
    await ctx.reply('🛑 Invalid Student ID format (ST1234). Try again or cancel:', Markup.keyboard([['🛑 Cancel']]).resize());
    return;
  }

  try {
    const student = await Student.findOne({ studentId: input });
    if (!student) {
      await ctx.reply('🛑 Student ID not found.');
      return;
    }

    if (student.parentId || student.pendingParentId) {
      await ctx.reply('🛑 This student is already linked or pending linkage.');
      return;
    }

    student.pendingParentId = ctx.from.id.toString();
    student.pendingParentAt = Date.now();
    await student.save();

    const parentUser = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (parentUser) {
      parentUser.pendingStudentRequests = parentUser.pendingStudentRequests || [];
      parentUser.pendingStudentRequests.push({ studentId: input, requestedAt: Date.now() });
      await parentUser.save();
    }

    const parentName = parentUser?.name || ctx.from.first_name || 'Parent';
    const parentId = ctx.from.id.toString();
    const requestId = `${parentId}_${input}`; // ✅ consistent with approval handler
    const sentMessages = [];

    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      try {
        const msg = await ctx.telegram.sendMessage(
          admin.telegramId,
          `📋 <b>New Parent-Student Link Request</b>\n\n` +
          `👤 Parent: <b>${parentName}</b> (ID: ${parentId})\n` +
          `🎓 Student: <b>${input}</b>\n` +
          `📅 Requested: <b>${new Date().toLocaleString()}</b>\n\n` +
          `Please approve or deny this request:`,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('✅ Approve', `approve_parent_${parentId}_${input}`),
                Markup.button.callback('🛑 Deny', `deny_parent_${parentId}_${input}`)
              ]
            ])
          }
        );
        sentMessages.push({ adminId: admin.telegramId, messageId: msg.message_id });
      } catch (err) {
        console.error(`Failed to notify admin ${admin.telegramId}:`, err.message);
      }
    }

    if (sentMessages.length > 0) {
      const approvalDoc = new ApprovalMessage({
        type: 'parent',
        requestId,
        messages: sentMessages,
        createdAt: new Date()
      });
      await approvalDoc.save();
    }

    await ctx.replyWithHTML(
      `✅ <b>Link Request Submitted!</b>\n\n` +
      `🎓 Student ID: <b>${input}</b>\n` +
      `⏳ Status: Pending admin approval.\n\n` +
      `You'll be notified once an admin reviews your request.`,
      parentMenu
    );
    ctx.scene.leave();

    setTimeout(async () => {
      try {
        const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
        if (!approval) return; // already processed

        const freshStudent = await Student.findOne({ studentId: input });
        if (!freshStudent) return;

        if (freshStudent.pendingParentId === parentId) {
          freshStudent.pendingParentId = null;
          freshStudent.pendingParentAt = null;
          await freshStudent.save();

          const freshUser = await User.findOne({ telegramId: parentId });
          if (freshUser) {
            freshUser.pendingStudentRequests = (freshUser.pendingStudentRequests || []).filter(r => r.studentId !== input);
            await freshUser.save();
          }

          await ApprovalMessage.deleteOne({ _id: approval._id });

          const expiredText =
            `⌛ <b>Parent-Student Link Request Expired</b>\n\n` +
            `👤 Parent: <b>${parentName}</b> (ID: ${parentId})\n` +
            `🎓 Student: <b>${input}</b>\n` +
            `📅 Requested: <b>${approval.createdAt.toLocaleString()}</b>\n\n` +
            `⚠️ No admin action was taken within 5 minutes.\n` +
            `The pending request has been automatically cleared.`;

          const master = await User.findOne({ role: 'masterAdmin' });
          if (master) {
            await ctx.telegram.sendMessage(master.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          for (const admin of admins) {
            await ctx.telegram.sendMessage(admin.telegramId, expiredText, { parse_mode: 'HTML' });
          }

          await ctx.telegram.sendMessage(
            parentId,
            `⚠️ Your request to link student <b>${input}</b> has expired after 5 minutes without admin review and was cleared.`,
            { parse_mode: 'HTML' }
          );

        }
      } catch (err) {
        console.error('Error auto-clearing expired parent link:', err);
      }
    }, 5 * 60 * 1000);

  } catch (error) {
    console.error('Error linking student:', error);
    await ctx.reply('🛑 Error while linking student. Try again or cancel:', Markup.keyboard([['🛑 Cancel']]).resize());
  }
});

stage.register(linkAnotherStudentScene);

// Admin Login Scene
const adminLoginScene = new Scenes.BaseScene('admin_login_scene');

adminLoginScene.enter(async (ctx) => {
    try {
        const existingUser = await User.findOne({ telegramId: ctx.from.id.toString() });

        if (existingUser && existingUser.role === 'admin') {
            ctx.reply(
                `🛑 You are already registered as an Administrator.\n\n` +
                `👤 Name: ${existingUser.name || 'N/A'}\n` +
                `🎭 Role: ${existingUser.role}\n\n` +
                `⚠️ You cannot have multiple roles on the same account.`
            );
            return ctx.scene.leave();
        }

        ctx.reply('🏫 Please enter the School Code to begin administrator registration:');
        ctx.scene.session.state = 'awaiting_school_code';

    } catch (err) {
        console.error('Error entering admin registration scene:', err);
        ctx.reply('🛑 Failed to start admin registration. Please try again later.');
        ctx.scene.leave();
    }
});

adminLoginScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim();

    if (ctx.scene.session.state === 'awaiting_school_code') {
        if (input === process.env.SCHOOL_CODE) {
            ctx.reply('✅ School Code accepted. Now, please enter the Admin Secret Key to complete your login:');
            ctx.scene.session.state = 'awaiting_admin_key';
        } else {
            ctx.reply('🛑 Invalid School Code. Please re-enter the correct School Code:');
        }

    } else if (ctx.scene.session.state === 'awaiting_admin_key') {
        if (input === process.env.ADMIN_SECRET_CODE) {
            let admin = await User.findOne({ telegramId: ctx.from.id });

            if (!admin) {
                admin = new User({
                    telegramId: ctx.from.id,
                    role: 'admin',
                    name: ctx.from.first_name || 'Admin',
                    adminId: await generateUniqueAdminId()
                });
                await admin.save();
            } else {
                admin.role = 'admin';
                if (!admin.adminId) {
                    admin.adminId = await generateUniqueAdminId();
                }
                await admin.save();
            }

            ctx.reply('✅ Admin login successful!', adminMenu);

            try {
                const masterAdmin = await User.findOne({ role: "masterAdmin" });
                if (masterAdmin) {
                    const notifyMsg =
                        `📢 <b>New Admin Login</b>\n\n` +
                        `👤 <b>Name:</b> ${admin.name}\n` +
                        `🆔 <b>Admin ID:</b> ${admin.adminId}\n` +
                        `💬 <b>Telegram ID:</b> ${admin.telegramId}\n` +
                        `📅 Time: ${new Date().toLocaleString()}`;

                    await ctx.telegram.sendMessage(masterAdmin.telegramId, notifyMsg, { parse_mode: "HTML" });
                }

            } catch (err) {
                console.error("Failed to notify Master Admin of login:", err);
            }

        } else {
            ctx.reply('🛑 Invalid Admin Secret Key. Access denied.');
        }

        ctx.scene.leave();
    }
});

stage.register(adminLoginScene);



// Unbind Parent Scene
const unbindParentScene = new Scenes.BaseScene('unbind_parent_scene');

unbindParentScene.enter((ctx) => {
    ctx.reply(
        '🆔 Please provide the **6-digit Student ID** to unbind the parent from, or press 🛑 Cancel.',
        Markup.keyboard([['🛑 Cancel']]).oneTime().resize()
    );
});

unbindParentScene.on('text', async (ctx) => {
    const input = ctx.message.text.trim();

    if (input === '🛑 Cancel') {
        await ctx.reply('🛑 Unbind operation cancelled. Returning to admin menu.', adminMenu);
        return ctx.scene.leave();
    }

    

    try {
        const student = await getStudentById(input);
        
        if (!student || !student.parentId) {
            ctx.reply(`⚠️ Student ID <b>${input}</b> not found or this student is not currently linked to a parent.`, { parse_mode: 'HTML', ...adminMenu });
            return ctx.scene.leave();
        }

        const parent = await getUserById(student.parentId);
        
        if (!parent) {
            ctx.reply(`⚠️ Corrupted link: Student <b>${input}</b> is linked to a Parent ID that does not exist.`, { parse_mode: 'HTML', ...adminMenu });
            return ctx.scene.leave();
        }
        
        ctx.scene.session.studentIdToUnbind = input;
        ctx.scene.session.studentName = student.name;
        ctx.scene.session.parentId = parent.telegramId; // store telegramId instead of _id for notifications
        ctx.scene.session.parentName = parent.name || parent.telegramId;
        
        await ctx.replyWithHTML(
            `❓ <b>CONFIRM UNBINDING ACTION</b>\n\n` +
            `Are you sure you want to proceed with unbinding?\n\n` +
            `🎓 <b>Student:</b> ${student.name} (ID: <code>${input}</code>)\n` +
            `👨‍👩‍👧 <b>Current Parent:</b> ${parent.name || 'N/A'} (ID: <code>${student.parentId}</code>)\n\n` +
            `This action will remove the parent's access to this student's data and may demote the parent's role to 'user'.`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirm Unbind', 'confirm_unbind')],
                [Markup.button.callback('🛑 Cancel Operation', 'cancel_unbind')]
            ])
        );

    } catch (error) {
        console.error('Error fetching data in unbind parent scene:', error);
        ctx.reply('🛑 An internal error occurred while fetching user data. Please check logs.', adminMenu);
        ctx.scene.leave();
    }
});

unbindParentScene.action('confirm_unbind', async (ctx) => {
    await ctx.answerCbQuery('Processing unbind...');
    
    const studentId = ctx.scene.session.studentIdToUnbind;
    const parentId = ctx.scene.session.parentId; // telegramId
    const studentName = ctx.scene.session.studentName;
    const parentName = ctx.scene.session.parentName;
    const adminId = ctx.from.id;
    const adminName = ctx.from.username || ctx.from.first_name;

    try {
        const parent = await getUserById(parentId);
        if (parent) {
            parent.studentIds = parent.studentIds.filter(id => id !== studentId);

            if (parent.studentIds.length === 0) {
                parent.role = 'user';
            }
            await parent.save();
        }

        const student = await getStudentById(studentId);
        if (student) {
            student.parentId = null;
            await student.save();
        }
        
        if (parent) {
            if (parent.studentIds.length > 0) {
                await ctx.telegram.sendMessage(
                    parent.telegramId,
                    `⚠️ You have been unlinked from student: ${studentName} (ID: ${studentId}).`,
                    parentMenu
                );
            } else {
                await ctx.telegram.sendMessage(
                    parent.telegramId,
                    `⚠️ You have been unlinked from student: ${studentName} (ID: ${studentId}).\n\nYou currently have no linked students. Please log in again to continue.`,
                    loginMenu
                );
            }
        }

        await logAdminAction(ctx, 'UNBIND_PARENT', {
  studentId,
  studentName,
  parentId,
  parentName
});


        const notificationMessage = `🚨 <b>Admin Action Alert</b> 🚨\n\n` +
            `👨‍💼 <b>Admin:</b> ${adminName} (ID: <code>${adminId}</code>)\n` +
            `🗑️ <b>Action:</b> Parent Unbind Successful\n\n` +
            `🎓 <b>Student:</b> ${studentName} (ID: <code>${studentId}</code>)\n` +
            `👨‍👩‍👧 <b>Unbound Parent:</b> ${parentName} (ID: <code>${parentId}</code>)\n\n` +
            `✅ <b>Approved by:</b> ${adminName} (ID: <code>${adminId}</code>)`;
            
        if (process.env.MASTER_ADMIN_ID) {
            await ctx.telegram.sendMessage(process.env.MASTER_ADMIN_ID, notificationMessage, { parse_mode: 'Markdown' });
        }
        await ctx.editMessageText(
            `✅ SUCCESS!\nParent <b>${parentName}</b> has been unbound from student <b>${studentName}</b> (ID: <code>${studentId}</code>).\n\n` +
            `📝 Approved by: ${adminName} (ID: ${adminId})`,
            { parse_mode: 'HTML' }
        );
        await ctx.reply('Returning to admin menu.', adminMenu);

    } catch (error) {
        console.error('Error during final unbind confirmation:', error);
        
        

        await ctx.editMessageText('🛑 An error occurred during the database update. Check the console logs for details.');
        await ctx.reply('Returning to admin menu.', adminMenu);
    }
    
    ctx.scene.leave();
});

unbindParentScene.action('cancel_unbind', async (ctx) => {
    await ctx.answerCbQuery('Cancellation acknowledged.');
    const adminId = ctx.from.id;
    const adminName = ctx.from.username || ctx.from.first_name;

    await ctx.editMessageText(
        `🛑 Unbind operation for student ID ${ctx.scene.session.studentIdToUnbind} cancelled.\n\n` +
        `📝 Denied by: ${adminName} (ID: ${adminId})`
    );
    await ctx.reply('Returning to admin menu.', adminMenu);
    
    ctx.scene.leave();
});
stage.register(unbindParentScene);



const editTeacherScene = new Scenes.BaseScene('edit_teacher_scene');

editTeacherScene.enter(async (ctx) => {
    try {
        const teachers = await Teacher.find().sort({ name: 1 });
        
        if (teachers.length === 0) {
            ctx.reply('🛑 No teachers found. Please add teachers first.');
            return ctx.scene.leave();
        }
        
        const teacherButtons = teachers.map(teacher => 
            [Markup.button.callback(
                `${teacher.name} (ID: ${teacher.teacherId})`, 
                `select_teacher_${teacher.teacherId}`
            )]
        );
        
        teacherButtons.push([Markup.button.callback('🛑 Cancel', 'cancel_edit_teacher')]);
        
        ctx.reply('🧑🏫 Select a teacher to edit:', Markup.inlineKeyboard(teacherButtons));
    } catch (error) {
        console.error('Error retrieving teachers:', error);
        ctx.reply('🛑 An error occurred while retrieving teachers.');
        ctx.scene.leave();
    }
});

editTeacherScene.action(/^select_teacher_(.+)$/, async (ctx) => {
    const teacherId = ctx.match[1];
    await ctx.answerCbQuery();
    
    try {
        const teacher = await getTeacherById(teacherId);
        if (!teacher) {
            ctx.reply('🛑 Teacher not found. Please try again.');
            return ctx.scene.leave();
        }
        
        ctx.session.editTeacherId = teacherId;
        ctx.session.editTeacherName = teacher.name;
        
let subjectsInfo = teacher.subjects.length > 0 ? 
    teacher.subjects.join(', ') : 
    'No subjects assigned';

let telegramInfo = teacher.telegramId ? 
    `${teacher.telegramId}` : 
    'Not linked';

ctx.replyWithHTML(
    `📋 Teacher Information:\n` +
    `• Name: ${teacher.name}\n` +
    `• ID: ${teacher.teacherId}\n` +
    `• Telegram ID: ${telegramInfo}\n` +
    `• Subjects: ${subjectsInfo}\n\n` +
    `Which field do you want to edit?`,
    Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Name', 'edit_teacher_name')],
        [Markup.button.callback('📚 Manage Subjects', 'edit_teacher_subjects_scene')],
        [Markup.button.callback('⬅️ Cancel', 'cancel_edit_teacher')]
    ])
);

    } catch (error) {
        console.error('Error in edit teacher scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.');
        ctx.scene.leave();
    }
});

editTeacherScene.action('cancel_edit_teacher', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('🛑 Edit cancelled.', {
        reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
    });
    ctx.scene.leave();
});

const editTeacherNameScene = new Scenes.BaseScene('edit_teacher_name_scene');

editTeacherNameScene.enter((ctx) => 
    ctx.reply('Please enter the new name for the teacher.')
);

editTeacherNameScene.on('text', async (ctx) => {
    const newName = ctx.message.text.trim();
    if (!isValidName(newName)) {
        ctx.reply('🛑 Invalid name. Please provide a non-empty name (max 100 characters).');
        return;
    }
    try {
        const teacher = await getTeacherById(ctx.session.editTeacherId);
        if (teacher && newName) {
            const oldName = teacher.name;

            teacher.name = newName;
            await teacher.save();

            const user = await getUserById(teacher.telegramId);
            if (user) {
                user.name = newName;
                await user.save();
            }

            await logAdminAction(ctx, 'EDIT_TEACHER_NAME', {
              teacherId: teacher.teacherId || teacher._id,
              oldName,
              newName,
              telegramId: teacher.telegramId
            });

            ctx.reply(`✅ Teacher name updated to "${newName}".`);
        } else {
            ctx.reply('🛑 Invalid name or teacher ID.');
        }
    } catch (error) {
        console.error('Error in edit teacher name scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.');
    }
    ctx.scene.leave();
});

const editTeacherSubjectsScene = new Scenes.BaseScene('edit_teacher_subjects_scene');

editTeacherSubjectsScene.enter(async (ctx) => {
    try {
        const teacherId = ctx.session.editTeacherId;
        const teacher = await getTeacherById(teacherId);
        
        if (!teacher) {
            ctx.reply('🛑 Teacher not found.', {
                reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
            });
            return ctx.scene.leave();
        }
        
        const subjects = teacher.subjects || [];
        
        if (subjects.length === 0) {
            ctx.reply('📚 This teacher has no subjects assigned yet.', Markup.inlineKeyboard([
                [Markup.button.callback('➕ Add Subject', 'add_new_subject_to_teacher')],
                [Markup.button.callback('⬅️ Back to Teacher Edit', 'back_to_teacher_edit')]
            ]));
            return;
        }
        
        let message = `📚 Current Subjects for ${teacher.name}:\n\n`;
        
        subjects.forEach((subject, index) => {
            message += `${index + 1}. ${subject}\n`;
        });
        
        const subjectButtons = subjects.map(subject => 
            [Markup.button.callback(`🗑️ Remove: ${subject}`, `remove_subject_${subject.replace(/ /g, '_')}`)]
        );
        
        subjectButtons.push(
            [Markup.button.callback('➕ Add Subject', 'add_new_subject_to_teacher')],
            [Markup.button.callback('⬅️ Back to Teacher Edit', 'back_to_teacher_edit')]
        );
        
        ctx.replyWithHTML(message, Markup.inlineKeyboard(subjectButtons));
        
    } catch (error) {
        console.error('Error in edit teacher subjects scene:', error);
        ctx.reply('🛑 An error occurred while retrieving subjects.', {
            reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
        });
        ctx.scene.leave();
    }
});
editTeacherSubjectsScene.action(/^remove_subject_(.+)$/, async (ctx) => {
    const subjectToRemove = ctx.match[1].replace(/_/g, ' ');
    await ctx.answerCbQuery();

    try {
        const teacherId = ctx.session.editTeacherId;
        const teacher = await getTeacherById(teacherId);

        if (!teacher) {
            ctx.reply('🛑 Teacher not found.');
            return ctx.scene.leave();
        }

        const oldSubjects = [...(teacher.subjects || [])];

        teacher.subjects = teacher.subjects.filter(s => s !== subjectToRemove);
        await teacher.save();

        let user = null;
        if (teacher.telegramId) {
            user = await getUserById(teacher.telegramId);
            if (user) {
                user.subjects = user.subjects.filter(s => s !== subjectToRemove);
                await user.save();
            }
        }

        await logAdminAction(ctx, 'REMOVE_TEACHER_SUBJECT', {
            teacherId: teacher.teacherId || teacher._id,
            teacherName: teacher.name,
            removedSubject: subjectToRemove,
            remainingSubjects: teacher.subjects,
            admin: ctx.from.first_name || ctx.from.username || 'Unknown',
            adminId: ctx.from.id,
            date: new Date().toISOString()
        });

        if (user) {
            try {
                await ctx.telegram.sendMessage(
                    teacher.telegramId,
                    `⚠️ Subject removed by admin.\n\n📚 Subject: ${subjectToRemove}\n👨‍🏫 Teacher: ${teacher.name} \n Admin : ${ctx.from.first_name || ctx.from.username || 'Unknown'}\n\nRemaining subjects: ${teacher.subjects.join(', ') || 'None'}`
                );
            } catch (e) {
                console.warn(`Could not notify teacher ${teacher.name}:`, e.message);
            }
        }

        if (process.env.MASTER_ADMIN_ID) {
            await ctx.telegram.sendMessage(
                process.env.MASTER_ADMIN_ID,
                `🚨 <b>Admin Action Alert</b>\n\n` +
                `👨‍💼 Admin: ${ctx.from.first_name || ctx.from.username} (ID: <code>${ctx.from.id}</code>)\n` +
                `🗑️ Action: Removed Teacher Subject\n\n` +
                `👨‍🏫 Teacher: ${teacher.name} (ID: ${teacherId})\n` +
                `📚 Removed Subject: ${subjectToRemove}\n` +
                `📋 Remaining Subjects: ${teacher.subjects.join(', ') || 'None'}\n` +
                `🕒 Date: ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        }

        ctx.reply(`✅ Subject "${subjectToRemove}" has been removed from ${teacher.name}.`);

        setTimeout(() => {
            ctx.scene.reenter();
        }, 1000);

    } catch (error) {
        console.error('Error removing subject:', error);

        await logAdminAction(ctx, 'REMOVE_TEACHER_SUBJECT_ERROR', {
            teacherId: ctx.session.editTeacherId,
            error: error.message,
            admin: ctx.from.first_name || ctx.from.username || 'Unknown',
            adminId: ctx.from.id,
            date: new Date().toISOString()
        });

        ctx.reply('🛑 An error occurred while removing the subject.');
        ctx.scene.leave();
    }
});


editTeacherSubjectsScene.action('add_new_subject_to_teacher', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('📝 Please enter the new subject to add:');
    ctx.scene.enter('add_subject_to_teacher_scene');
});

editTeacherSubjectsScene.action('back_to_teacher_edit', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('edit_teacher_scene');
});

editTeacherSubjectsScene.hears(['⬅️ Main Menu', '🏠 Main Menu', '↩️ Main Menu', '🔙 Main Menu'], async (ctx) => {
    await returnToM
});


bot.action('edit_teacher_subjects_scene', async (ctx) => {
    await ctx.answerCbQuery(); // remove the "loading" animation
    ctx.scene.enter('edit_teacher_subjects_scene');
});

const addSubjectToTeacherScene = new Scenes.BaseScene('add_subject_to_teacher_scene');

addSubjectToTeacherScene.enter((ctx) => {
    ctx.reply('📝 Please enter the new subject to add to this teacher:');
});

addSubjectToTeacherScene.enter((ctx) => {
    ctx.reply('📝 Please enter the new subject to add to this teacher:');
});

addSubjectToTeacherScene.on('text', async (ctx) => {
    const newSubject = ctx.message.text.trim();
    
    if (!isValidSubject(newSubject)) {
        ctx.reply('🛑 Invalid subject. Please enter a non-empty subject name (max 50 characters).');
        return;
    }
    
    try {
        const teacherId = ctx.session.editTeacherId;
        const teacher = await getTeacherById(teacherId);
        
        if (!teacher) {
            ctx.reply('🛑 Teacher not found.', {
                reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
            });
            return ctx.scene.leave();
        }
        
        if (teacher.subjects.includes(newSubject)) {
            ctx.reply(`🛑 Subject "${newSubject}" is already assigned to this teacher.`);
            return ctx.scene.leave();
        }
        
        teacher.subjects.push(newSubject);
        await teacher.save();
        
        if (teacher.telegramId) {
            const user = await getUserById(teacher.telegramId);
            if (user) {
                if (!user.subjects.includes(newSubject)) {
                    user.subjects.push(newSubject);
                    await user.save();
                }
            }
        }

        await logAdminAction(ctx, 'ADD_TEACHER_SUBJECT', {
            teacherId: teacher.teacherId || teacher._id,
            teacherName: teacher.name,
            addedSubject: newSubject,
            newSubjects: teacher.subjects
        });
        
        ctx.reply(`✅ Subject "${newSubject}" has been added to ${teacher.name}.`);
        
        setTimeout(() => {
            ctx.scene.enter('edit_teacher_subjects_scene');
        }, 1000);
        
    } catch (error) {
        console.error('Error adding subject to teacher:', error);
        ctx.reply('🛑 An error occurred while adding the subject.', {
            reply_markup: { keyboard: userManagementMenu.reply_markup.keyboard, resize_keyboard: true }
        });
        ctx.scene.leave();
    }
});

addSubjectToTeacherScene.action('back_to_subjects', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('edit_teacher_subjects_scene');
});

addSubjectToTeacherScene.hears(['⬅️ Back', '🔙 Back'], async (ctx) => {
    ctx.scene.enter('edit_teacher_subjects_scene');
});

addSubjectToTeacherScene.hears(['⬅️ Main Menu', '🏠 Main Menu', '↩️ Main Menu', '🔙 Main Menu'], async (ctx) => {
    await returnToMenu(ctx, '🛑 Subject addition cancelled.');
});
stage.register(addSubjectToTeacherScene);



stage.register(editTeacherScene);
stage.register(editTeacherNameScene);
stage.register(editTeacherSubjectsScene);

const announcementRecipientScene = new Scenes.BaseScene('announcement_recipient_scene');
announcementRecipientScene.enter((ctx) => {
    ctx.reply('📢 Who do you want to send the announcement to?', Markup.inlineKeyboard([
        [Markup.button.callback('👑 All Admins', 'announce_admins')],
        [Markup.button.callback('👨‍👩‍👧‍👦 All Parents', 'announce_parents')],
        [Markup.button.callback('🧑🏫 All Teachers', 'announce_teachers')],
        [Markup.button.callback('📢 Announce by Class', 'announce_by_class')],
        [Markup.button.callback('🛑 Cancel', 'cancel_announcement')]
    ]));
});

announcementRecipientScene.action('announce_admins', async (ctx) => {
    ctx.session.announcementTarget = 'admins';
    await ctx.answerCbQuery();
    await ctx.reply('📝 Please send the announcement message or media to send to all admins.');
    ctx.scene.enter('send_announcement_scene');
});

announcementRecipientScene.action('announce_parents', async (ctx) => {
    ctx.session.announcementTarget = 'parents';
    await ctx.answerCbQuery();
    await ctx.reply('📝 Please send the announcement message to send to all parents.');
    ctx.scene.enter('send_announcement_scene');
});

announcementRecipientScene.action('announce_teachers', async (ctx) => {
    ctx.session.announcementTarget = 'teachers';
    await ctx.answerCbQuery();
    await ctx.reply('📝 Please send the announcement message to send to all teachers.');
    ctx.scene.enter('send_announcement_scene');
});

announcementRecipientScene.action('cancel_announcement', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('🛑 Announcement cancelled.', adminMenu);
    ctx.scene.leave();
});
stage.register(announcementRecipientScene);
const sendAnnouncementScene = new Scenes.BaseScene('send_announcement_scene');


sendAnnouncementScene.enter(async (ctx) => {
  ctx.reply('📝 Please send the announcement message or media you want to send.');
});

sendAnnouncementScene.on(['text', 'photo', 'video', 'document', 'audio', 'voice'], async (ctx) => {
  const isText = ctx.message.text || false;
  const isMedia =
    ctx.message.photo || ctx.message.video || ctx.message.document || ctx.message.audio || ctx.message.voice;

  let announcementText = '';
  if (isText) {
    announcementText = ctx.message.text.trim();
    if (!announcementText) {
      ctx.reply('🛑 Announcement cannot be empty. Please send the announcement message or media again.');
      return;
    }
  } else if (isMedia) {
    announcementText = ctx.message.caption ? ctx.message.caption.trim() : '';
  }

  const target = ctx.session.announcementTarget;
  if (!target) {
    ctx.reply('🛑 Target audience not set. Please start again.', adminMenu);
    return ctx.scene.leave();
  }

  const senderName = ctx.from.first_name || ctx.from.username || 'Admin';

  try {
    let recipients;
    if (target === 'admins') {
      recipients = await User.find({ role: 'admin' });
    } else if (target === 'parents') {
      recipients = await User.find({ role: 'parent' });
    } else if (target === 'teachers') {
      recipients = await User.find({ role: 'teacher' });
    } else {
      ctx.reply('🛑 Invalid target audience.', adminMenu);
      return ctx.scene.leave();
    }

    const filteredRecipients = recipients.filter(r => r.telegramId !== ctx.from.id.toString());

    let successCount = 0;
    let failedCount = 0;

    const caption = announcementText
      ? `📢 Announcement from ${senderName}:\n${announcementText}`
      : `📢 Announcement from ${senderName}`;

    const batchSize = 20;
    for (let i = 0; i < filteredRecipients.length; i += batchSize) {
      const batch = filteredRecipients.slice(i, i + batchSize);

      await Promise.allSettled(batch.map(async (user) => {
        try {
          if (isText) {
            await ctx.telegram.sendMessage(user.telegramId, caption, { parse_mode: "HTML" });
          } else if (ctx.message.photo) {
            const photo = ctx.message.photo.at(-1);
            await ctx.telegram.sendPhoto(user.telegramId, photo.file_id, { caption, parse_mode: "HTML" });
          } else if (ctx.message.video) {
            await ctx.telegram.sendVideo(user.telegramId, ctx.message.video.file_id, { caption, parse_mode: "HTML" });
          } else if (ctx.message.document) {
            await ctx.telegram.sendDocument(user.telegramId, ctx.message.document.file_id, { caption, parse_mode: "HTML" });
          } else if (ctx.message.audio) {
            await ctx.telegram.sendAudio(user.telegramId, ctx.message.audio.file_id, { caption, parse_mode: "HTML" });
          } else if (ctx.message.voice) {
            await ctx.telegram.sendVoice(user.telegramId, ctx.message.voice.file_id, { caption, parse_mode: "HTML" });
          }
          successCount++;
        } catch (error) {
          if (error.response?.error_code === 403) {
          } else {
            console.error(`Failed to send announcement to ${user.telegramId}:`, error);
          }
          failedCount++;
        }
      }));

      await sleep(1000);
    }

    let summaryMessage = `✅ Announcement finished!\n\n`;
    summaryMessage += `• Target: ${target}\n`;
    summaryMessage += `• Successful deliveries: ${successCount}\n`;
    summaryMessage += `• Failed deliveries: ${failedCount}\n`;

    if (filteredRecipients.length === 0) {
      summaryMessage = `ℹ️ No recipients found for ${target} (excluding yourself).`;
    }

    await ctx.reply(summaryMessage, adminMenu);

    await logAdminAction(ctx, 'ANNOUNCEMENT_SENT', {
      target,
      text: announcementText,
      successCount,
      failedCount
    });

    if (isText) {
      await notifyMasterAdmin(ctx, 'ANNOUNCEMENT_SENT', {
        sender: senderName,
        target,
        text: announcementText,
        successCount,
        failedCount
      });
    } else if (isMedia) {
      const masterAdminId = process.env.MASTER_ADMIN_ID; // <-- make sure you set this in your env
      const notifyCaption =
        `📢 Announcement Sent\n\n👤 From: ${senderName}\n🎯 Target: ${target}\n✅ Delivered: ${successCount}\n🛑 Failed: ${failedCount}\n\n${announcementText || ''}`;

      try {
        if (ctx.message.photo) {
          const photo = ctx.message.photo.at(-1);
          await ctx.telegram.sendPhoto(masterAdminId, photo.file_id, { caption: notifyCaption, parse_mode: "HTML" });
        } else if (ctx.message.video) {
          await ctx.telegram.sendVideo(masterAdminId, ctx.message.video.file_id, { caption: notifyCaption, parse_mode: "HTML" });
        } else if (ctx.message.document) {
          await ctx.telegram.sendDocument(masterAdminId, ctx.message.document.file_id, { caption: notifyCaption, parse_mode: "HTML" });
        } else if (ctx.message.audio) {
          await ctx.telegram.sendAudio(masterAdminId, ctx.message.audio.file_id, { caption: notifyCaption, parse_mode: "HTML" });
        } else if (ctx.message.voice) {
          await ctx.telegram.sendVoice(masterAdminId, ctx.message.voice.file_id, { caption: notifyCaption, parse_mode: "HTML" });
        }
      } catch (err) {
        console.error('Failed to notify master admin with media announcement:', err);
      }
    }

  } catch (error) {
    console.error('Error in send announcement scene:', error);
    ctx.reply('🛑 An error occurred. Please try again.', adminMenu);

    await logAdminAction(ctx, 'ANNOUNCEMENT_ERROR', { error: error.message });
    await notifyMasterAdmin(ctx, 'ANNOUNCEMENT_ERROR', { error: error.message });
  } finally {
    ctx.scene.leave();
  }
});

sendAnnouncementScene.on('message', (ctx) => {
  ctx.reply('🛑 Unsupported message type. Please send text, photo, video, document, audio, or voice.');
});

stage.register(sendAnnouncementScene);




const contactParentScene = new Scenes.BaseScene('contact_parent_scene');
contactParentScene.enter((ctx) => ctx.reply('🆔 Please enter the student ID of the parent you want to contact.'));
contactParentScene.on('text', async (ctx) => {
    const studentId = ctx.message.text.trim();
    if (!isValidStudentId(studentId)) {
        ctx.reply('🛑 Invalid Student ID. Please provide a 10-digit ID.');
        return ctx.scene.leave();
    }
    try {
        const student = await getStudentById(studentId);
        if (!student || !student.parentId) {
            return ctx.reply('🛑 Student ID not found or student has no linked parent.');
        }
        ctx.session.recipientId = student.parentId;
        ctx.reply('📝 Please type the message you want to send to the parent.');
        ctx.scene.enter('send_message_scene');
    } catch (error) {
        console.error('Error in contact parent scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.');
        ctx.scene.leave();
    }
});
stage.register(contactParentScene);

const sendMessageScene = new Scenes.BaseScene('send_message_scene');
sendMessageScene.on('text', async (ctx) => {
    const message = ctx.message.text.trim();
    const recipientId = ctx.session.recipientId;
    if (!isValidAnnouncementOrMessage(message) || !recipientId) {
        ctx.reply('🛑 Message cannot be empty or recipient not set.');
        return ctx.scene.leave();
    }
    try {
        const sender = await getUserById(ctx.from.id);
        const senderRole = sender.role === 'teacher' ? 'Teacher' : 'Admin';
        await ctx.telegram.sendMessage(recipientId, `📢 Message from ${senderRole} (${sender.name}):
${message}`, { parse_mode: 'HTML' });
        ctx.reply('✅ Message sent successfully.', teacherMenu);
    } catch (error) {
        if (error.response && error.response.error_code === 403) {
            ctx.reply('🛑 Failed to send message. The recipient has blocked the bot.');
        } else {
            console.error(`Failed to send message:`, error);
            ctx.reply('🛑 Failed to send message. Please try again later.');
        }
    } finally {
        ctx.session.recipientId = null;
        ctx.scene.leave();
    }
});
stage.register(sendMessageScene);


const removeSubjectScene = new Scenes.BaseScene('remove_subject_scene');
removeSubjectScene.enter(async (ctx) => {
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (!teacher || !teacher.subjects || teacher.subjects.length === 0) {
            ctx.reply('🛑 You have no subjects to remove.', teacherMenu);
            return ctx.scene.leave();
        }
        const subjectButtons = teacher.subjects.map(s => [Markup.button.callback(s, `remove_subject_${s.replace(/ /g, '_')}`)]);
        ctx.reply('📚 Please select the subject you want to remove:', Markup.inlineKeyboard(subjectButtons));
    } catch (error) {
        console.error('Error in remove subject scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.');
        ctx.scene.leave();
    }
});
stage.register(removeSubjectScene);


const teacherAnnouncementScene = new Scenes.BaseScene('teacher_announcement_scene');
teacherAnnouncementScene.on('text', async (ctx) => {
    const announcement = ctx.message.text.trim();
    if (!isValidAnnouncementOrMessage(announcement)) {
        ctx.reply('🛑 Announcement cannot be empty.');
        return;
    }
    try {
        const user = await getUserById(ctx.from.id);
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        const subject = ctx.session.announcementSubject;
        if (!user || !teacher || !subject) {
            return ctx.reply('🛑 An error occurred. Please contact an admin.');
        }
        
        const students = await Student.find({
            [`grades.${subject.toLowerCase()}`]: { $exists: true, $ne: [] }
        });
        
        const parentIds = [...new Set(students.map(s => s.parentId).filter(id => id !== null))];
        
        for (const parentId of parentIds) {
            try {
                await ctx.telegram.sendMessage(parentId, `📢 Message from your child's ${subject} Teacher:
${announcement}`, { parse_mode: "HTML" });
            } catch (error) {
                if (error.response && error.response.error_code === 403) {
                } else {
                    console.error(`Failed to send announcement to parent ${parentId}:`, error);
                }
            }
        }
        ctx.reply('✅ Announcement sent to all parents of your students.', teacherMenu);
    } catch (error) {
        console.error('Error in teacher announcement scene:', error);
        ctx.reply('🛑 An error occurred. Please try again.');
    }
    ctx.scene.leave();
});
stage.register(teacherAnnouncementScene);


// --- Menus --- //

const adminMenu = Markup.keyboard([
  ['🎓 Students', '👥 Users', '🚫 Ban/Unban Teacher'],
  ['✉️ Contact Teacher', '📞 Contact Parent', '🛡 Contact Admins'],
  ['🔍 Search Database', '📁 Manage Uploads', '📢 Announcements']
]).resize();

const userManagementMenu = Markup.keyboard([
    ['✏️ Edit Teacher', '🗑️ Remove Teacher'],
    ['📋View Admins', '📋 View Teachers', '📋 View Parents'],
    ['⬅️ Back to Admin Menu']
]).resize();

const studentManagementMenu = Markup.keyboard([
    ['➕ Add Student', '➖ Remove Student', '✏️ Edit Student'],
    ['📤 Upload Student List', '⛓️‍💥 Unlink Parent', '🗑️ Delete Class'],
    ['📋 View All Students', '📋 View All Classes'],
    ['⬅️ Back to Admin Menu']
]).resize();

const loginMenu = Markup.keyboard([
    ['👨‍🏫 Teacher Registration', '👤 Parent Signup/Login'], ['❓ Help', 'ℹ️ About Us', '📜 FAQ']
]).resize();

const parentMenu = Markup.keyboard([
    ['💯 View Grades', '📅 View Attendance', '👨‍👩‍👧 My Children'],
    ['⛓️‍💥 Unlink a Student', '🔗 Link Another Student', '📚 Request a Tutor'],
    ['📩 Contact Teacher', '❓ Help/Contact School', '🌐 Change Language']
]).resize();

const parentMenuAm = Markup.keyboard([
  ['💯 ውጤቶች ይመልከቱ', '📅 የቀሩበት ቀን', '👨‍👩‍👧 ልጆቼ'],
  ['⛓️‍💥 ተማሪ ለይ', '🔗 ሌላ ተማሪ አገናኝ', '📚 ቱተር ጠይቅ'],
  ['📩 አስተማሪ ያግኙ', '❓ እገዛ/ትምህርት ቤትን ያነጋግሩ', '🌐 ቋንቋ ቀይር']
]).resize();

const masterAdminMenu = Markup.keyboard([
    ['👑 View All Admins', '🚫 Remove Admin'],
    ['📊 Admin Activities', '🔍 Admin Details'],
    ['🛡 Contact an Admin', '👥 Total Users'],
    ['📢 Broadcast Message/Ad']

]).resize();

const postLogoutMenu = Markup.keyboard([
  ['🔐 Login', '❓ Forgot Password']
]).resize();

const myClassMenu = Markup.keyboard([
  ['📚 My Students', '➕ Add a Student', '🗑️ Remove Student'],
  ['🔍 Search Students','📢 Announce to Students', '🗑 Remove Class'], 
  ['⬅️ Back to Main Menu']
]).resize();



const teacherMenu = Markup.keyboard([
    ['📖 My Subjects', '📋 Request Class', '📚 My Class'],   
    ['📝 Record Attendance', '📊 Manage Grades', '📤 Export Grades'],
    ['💬 Contact a Parent', '📢 Announce Parents', '🛡 Contact Admin' ],
    ['💼 Freelance', '📜 My Freelance',
'🔓 Logout']  
]).resize();

const teacherProfileMenu = Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add New Subject', 'add_new_subject'), Markup.button.callback('➖ Remove Subject', 'remove_subject')],
    [Markup.button.callback('⬅️ Back to Teacher Menu', 'back_to_teacher')]
]);

const parentProfileMenu = Markup.inlineKeyboard([
    [Markup.button.callback('🔗 Linked Students', 'view_linked_children')],
    [Markup.button.callback('⬅️ Back to Parent Menu', 'back_to_parent')]
]);



bot.action('announce_by_class', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('admin_announce_by_class_scene');
});


bot.action('record_by_class', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('record_attendance_by_class_scene');
});


// Admin: Reset Parent Contact Limit (fixed)
bot.command('reset_parent_contact_limit', async (ctx) => {
  try {
    

    const CONTACT_TIMEZONE = 'Africa/Addis_Ababa';
    const CONTACT_RESET_HOUR = parseInt(process.env.CONTACT_RESET_HOUR || '8', 10);

    function getContactDayKey(date = new Date()) {
      const dtf = new Intl.DateTimeFormat('en-GB', {
        timeZone: CONTACT_TIMEZONE,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit'
      });
      const parts = dtf.formatToParts(date).reduce((a, p) => { if (p.type && p.value) a[p.type] = p.value; return a; }, {});
      let year = +parts.year, month = +parts.month, day = +parts.day, hour = +parts.hour;
      if (hour < CONTACT_RESET_HOUR) {
        const d2 = new Date(date.getTime() - 24 * 60 * 60 * 1000);
        const p2 = new Intl.DateTimeFormat('en-GB', { timeZone: CONTACT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d2).reduce((a, p) => { if (p.type && p.value) a[p.type] = p.value; return a; }, {});
        year = +p2.year; month = +p2.month; day = +p2.day;
      }
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    const todayKey = getContactDayKey(new Date());

    // Delete today's ParentContact logs
    const deleteResult = await ParentContact.deleteMany({ dayKey: todayKey });

    const cleared = deleteResult && deleteResult.deletedCount ? deleteResult.deletedCount : 0;

    await ctx.reply(`✅ Parent contact limits have been reset. Cleared ${cleared} record(s) for day ${todayKey}. Parents can now contact teachers again today.`);

    await logAdminAction(ctx, 'RESET_PARENT_CONTACT_LIMIT', { dayKey: todayKey, countCleared: cleared });
  } catch (err) {
    console.error('Error resetting parent contact limit:', err);
    await ctx.reply('🛑 Failed to reset contact limits. Please check logs.');
  }
});



bot.command('cleanlogs', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user || !user.masterAdmin) {
        await ctx.reply('🛑 Unauthorized: Only the master admin can clean logs.');
        return;
    }

    await ctx.reply(
        '🧹 Are you sure you want to delete logs older than 24 hours?',
        Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirm', 'clean_logs_confirm')],
            [Markup.button.callback('🛑 Cancel', 'clean_logs_cancel')],
        ])
    );
});

bot.command('viewlogs', async (ctx) => {
  try {
    

    const logs = await ActivityLog.find();
    if (!logs || logs.length === 0) return ctx.reply('📭 No logs yet.');

    const logObjs = logs.map(l => (typeof l.toObject === 'function' ? l.toObject() : l));
    logObjs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const top = logObjs.slice(0, 15);

    let msg = '<b>📜 Recent Admin Logs:</b>\n\n';
    top.forEach((log, i) => {
      msg += `${i + 1}. 👤 ${log.adminName || log.adminId}\n`;
      msg += `   🔧 ${log.action || 'UNKNOWN'}\n`;
      msg += `   ⏰ ${new Date(log.timestamp).toLocaleString()}\n`;
      if (log.details && Object.keys(log.details).length) {
        msg += `   📄 Details: ${JSON.stringify(log.details)}\n`;
      }
      msg += '\n';
    });

    return ctx.replyWithHTML(msg);
  } catch (err) {
    console.error('Error fetching logs:', err);
    return ctx.reply('⚠️ Failed to fetch logs. Check the server logs for details.');
  }
});


bot.action(/^approve_unlink:([^:]+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const [parentId, studentId] = [ctx.match[1], ctx.match[2]];

    const admin = await User.findOne({
      telegramId: ctx.from.id,
      role: { $in: ['admin', 'master_admin'] }
    });

    if (!admin) {
      await ctx.reply('🛑 You are not authorized to approve this request.');
      return;
    }

    const parent = await User.findOne({ telegramId: parentId });
    const student = await Student.findOne({ studentId });

    if (!parent || !student) {
      await ctx.reply('🛑 Parent or student not found. Please verify the request.');
      return;
    }

    if (!parent.pendingUnlinkStudentIds?.includes(studentId)) {
      await ctx.reply('🛑 No pending unlink request found for this student.');
      return;
    }

    parent.studentIds = parent.studentIds?.filter(id => id !== studentId) || [];
    parent.pendingUnlinkStudentIds = parent.pendingUnlinkStudentIds.filter(id => id !== studentId);

    if ((!parent.studentIds || parent.studentIds.length === 0) &&
        (!parent.pendingStudentIds || parent.pendingStudentIds.length === 0)) {
      parent.role = 'user';
    }

    await parent.save();

    student.parentId = null;
    await student.save();

    const approverName = admin.name || ctx.from.first_name || 'Admin';
    const requestId = `${parentId}_unlink_${studentId}`;
    try {
      await ctx.reply(
        `✅ <b>Unlink Request Approved</b>\n\n` +
        `👤 Parent: <b>${parent.name}</b> (@${parent.username || 'N/A'})\n` +
        `🆔 Telegram ID: <b>${parent.telegramId}</b>\n` +
        `👶 Student: <b>${student.name}</b> (${studentId})\n\n` +
        `✅ Approved by: <b>${approverName}</b>\n` +
        `📅 ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`,
        { parse_mode: 'HTML' }
      );
    } catch (editError) {
      console.log('Could not edit original message:', editError.message);
    }

    await cleanAndNotifyAdminsForUnlink(ctx, requestId, student, parent, approverName);

    const parentMenuToUse = parent.role === 'parentAm' ? parentMenuAm : parentMenu;
    await ctx.telegram.sendMessage(
      parent.telegramId,
      parent.role === 'parentAm'
        ? `✅ የመለያ ማለያ ጥያቄዎ ለ ${student.name} (${studentId}) ተቀባይነት አግኝቷል።`
        : `✅ Your request to unlink ${student.name} (${studentId}) has been approved.`,
      { reply_markup: parentMenuToUse.reply_markup }
    );

    

    await notifyMasterAdmin(ctx, 'parent_unlink_approved', {
      parentId: parent.telegramId,
      parentName: parent.name,
      studentId,
      studentName: student.name,
      adminId: ctx.from.id,
      approvedBy: approverName,
      timestamp: new Date()
    });

    await logAdminAction(ctx, 'APPROVE_UNLINK', {
      parentId: parent.telegramId,
      parentName: parent.name,
      studentId,
      studentName: student.name,
      approvedBy: approverName,
      approvedAt: new Date(),
    });

  } catch (error) {
    console.error('Error approving unlink request:', error);
    await ctx.answerCbQuery('🛑 Error processing request');
    await ctx.reply('🛑 An error occurred while approving the unlink request. Please try again.');
  }
});


/// --- DENY UNLINK REQUEST ---

bot.action(/^deny_unlink:([^:]+):(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    const [parentId, studentId] = [ctx.match[1], ctx.match[2]];

    const admin = await User.findOne({
      telegramId: ctx.from.id,
      role: { $in: ['admin', 'master_admin'] }
    });

    if (!admin) {
      await ctx.reply('🛑 You are not authorized to deny this request.');
      return;
    }

    const parent = await User.findOne({ telegramId: parentId });
    const student = await Student.findOne({ studentId });

    if (!parent || !student) {
      await ctx.reply('🛑 Parent or student not found. Please verify the request.');
      return;
    }

    if (!parent.pendingUnlinkStudentIds?.includes(studentId)) {
      await ctx.reply('🛑 No pending unlink request found for this student.');
      return;
    }

    parent.pendingUnlinkStudentIds = parent.pendingUnlinkStudentIds.filter(id => id !== studentId);
    await parent.save();

    const denierName = admin.name || ctx.from.first_name || 'Admin';
    const requestId = `${parentId}_unlink_${studentId}`;

    await cleanAndNotifyAdminsForUnlinkDeny(ctx, requestId, student, parent, denierName);

    const parentMenuToUse = parent.role === 'parentAm' ? parentMenuAm : parentMenu;
    const parentMessage =
      parent.role === 'parentAm'
        ? `🛑 የመለያ ማለያ ጥያቄዎ ለ ${student.name} (${studentId}) ተከልክሏል።`
        : `🛑 Your request to unlink ${student.name} (${studentId}) was denied by an admin.`;

    await ctx.telegram.sendMessage(parent.telegramId, parentMessage, {
      reply_markup: parentMenuToUse.reply_markup
    });

    await notifyMasterAdmin(ctx, 'parent_unlink_denied', {
      parentId: parent.telegramId,
      parentName: parent.name,
      studentId,
      studentName: student.name,
      adminId: ctx.from.id,
      deniedBy: denierName,
      timestamp: new Date()
    });

    await logAdminAction(ctx, 'DENY_UNLINK', {
      parentId: parent.telegramId,
      parentName: parent.name,
      studentId,
      studentName: student.name,
      deniedBy: denierName,
      deniedAt: new Date()
    });

    await ctx.replyWithHTML(
      `🛑 <b>Unlink Request Denied</b>\n\n` +
      `👤 Parent: <b>${parent.name}</b> (@${parent.username || 'N/A'})\n` +
      `🆔 Telegram ID: <b>${parent.telegramId}</b>\n` +
      `👶 Student: <b>${student.name}</b> (${studentId})\n\n` +
      `❌ Denied by: <b>${denierName}</b>\n` +
      `📅 ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}`
    );

  } catch (error) {
    console.error('Error denying unlink request:', error);
    await ctx.answerCbQuery('🛑 Error processing request');
    await ctx.reply('🛑 An error occurred while denying the unlink request. Please try again.');
  }
});





bot.action('clean_logs_confirm', async (ctx) => {
    await ctx.answerCbQuery();
    try {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        const result = await User.updateMany(
            { 'activityLog.timestamp': { $lt: cutoffTime } },
            { $pull: { activityLog: { timestamp: { $lt: cutoffTime } } } }
        );

        const deletedCount = result.modifiedCount;
        await ctx.reply(`✅ Successfully deleted ${deletedCount} logs older than 24 hours.`, masterAdminMenu);
        
        await notifyMasterAdmin(ctx, 'logs_cleaned', {
            adminId: ctx.from.id,
            deletedCount,
            cutoffTime,
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('Error cleaning logs:', error);
        await ctx.reply('🛑 Error cleaning logs. Please try again.', masterAdminMenu);
        await notifyMasterAdmin(ctx, 'clean_logs_error', {
            adminId: ctx.from.id,
            error: error.message,
            timestamp: new Date(),
        });
    }
});

bot.action('clean_logs_cancel', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('✅ Log cleaning cancelled.', masterAdminMenu);
   
});
bot.command('control', async (ctx) => {
    const inputCode = ctx.message.text.split(' ')[1]?.trim();
    if (!inputCode) {
        await ctx.reply('🛑 ');
        return;
    }

    const STOP_CODE = 'STOP6455';
    const START_CODE = 'START6455';

    try {
        const state = await BotState.findOne({});

        if (inputCode === STOP_CODE && (!state || state.state === 'running')) {
            await BotState.updateOne(
                {},
                { state: 'stopped', lastUpdated: new Date(), updatedBy: ctx.from.id.toString() },
                { upsert: true }
            );
            notifiedUsers.clear(); 
            await ctx.reply('✅ Bot turned off. Use the start code to turn it back on.');
        } else if (inputCode === START_CODE && state?.state === 'stopped') {
            await BotState.updateOne(
                {},
                { state: 'running', lastUpdated: new Date(), updatedBy: ctx.from.id.toString() },
                { upsert: true }
            );
            notifiedUsers.clear(); 
            await ctx.reply('✅ Bot turned on.');
        } else {
            await ctx.reply('🛑 Invalid code or bot is already in the requested state.');
        }
    } catch (error) {
        console.error('Error in bot control:', error);
        await ctx.reply('🛑 Error processing control command.');
    }
});




bot.use(async (ctx, next) => {
    const state = await BotState.findOne({});
    const isControlCommand = ctx.message?.text?.startsWith('/control');

    if (isControlCommand) return next();

    if (state && state.state === 'stopped') {
        const userId = ctx.from?.id;
        if (userId && !notifiedUsers.has(userId)) {
            await ctx.reply('🤖 Bot is off. Use /control <code> to turn it on.');
            notifiedUsers.add(userId);
        }
        return; 
    }

    return next();
});







// --- Bot Commands ---

const initializeMasterAdmin = async () => {
    try {
        const masterAdminId = process.env.MASTER_ADMIN_ID;
        if (!masterAdminId) {
            console.log('⚠️  MASTER_ADMIN_ID not set in environment');
            return;
        }

        let masterAdmin = await User.findOne({ telegramId: masterAdminId });
        
        if (!masterAdmin) {
            masterAdmin = new User({
                telegramId: masterAdminId,
                name: 'Master Admin',
                role: 'masterAdmin',
                masterAdmin: true
            });
            await masterAdmin.save();
            console.log('✅ Master admin initialized');
        } else if (!masterAdmin.masterAdmin) {
            masterAdmin.masterAdmin = true;
            masterAdmin.role = 'admin';
            await masterAdmin.save();
            console.log('✅ Existing user promoted to master admin');
        }
    } catch (error) {
        console.error('Error initializing master admin:', error);
    }
};


initializeMasterAdmin();
 
bot.catch((err, ctx) => {
  console.error(`Bot error for ${ctx.updateType}`, err);

  if (
    err.description &&
    err.description.includes("query is too old and response timeout expired")
  ) {
    console.warn("⚠️ Ignored expired callback query");
    return; 
  }

  if (
    err.description &&
    err.description.includes("query ID is invalid")
  ) {
    console.warn("⚠️ Ignored invalid callback query");
    return; 
  }

  ctx.reply("🛑 An unexpected error occurred. Please try again.");
});



////////////start bot command////////////////////
//
//
//
//
//
//
//
//
//
//
//
//



// Start command handler
bot.command('start', async (ctx) => {


  try {
    const telegramId = ctx.from.id;
    const userName = `${ctx.from.first_name || ''} ${ctx.from.last_name || ''}`.trim() || 'Anonymous';
    const username = ctx.from.username || null;

    let user = await getUserById(ctx.from.id);

    if (!user) {
      user = new User({
        telegramId: ctx.from.id,
        name: userName,
        username,
        role: 'user', 
        createdAt: new Date()
      });
      await user.save();
      if (telegramId !== process.env.MASTER_ADMIN_ID) {
        await notifyMasterAdmin(ctx, 'new_user', {
          userId: telegramId,
          userName,
          username: username ? `@${username}` : 'N/A'
        });
      }
    }
      const master = process.env.MASTER_ADMIN_ID;
    let welcomeMessage = '';
    let menu;
    if (telegramId.toString() === process.env.MASTER_ADMIN_ID) { // Note: Check here too if MASTER_ADMIN_ID is undefined
       ctx.reply("Welcome Master Admin", masterAdminMenu);
      }else{
    
    switch (user.role) {
      case 'admin':
        welcomeMessage = `🛡 Welcome back: ${user.name}! (Admin ID: ${user.adminId || telegramId})\n`;
        menu = adminMenu;
        break;
      case 'teacher':
        welcomeMessage = `👨‍🏫 Welcome back: Teacher ${user.name}!\n`;
        menu = postLogoutMenu; 
        break;
      case 'parent':
      case 'parentAM':
        welcomeMessage = `👪 Welcome back: ${user.name}!\n`;
        menu = user.role === 'parentAM' ? parentMenuAm : parentMenu;
        break;
      default:
        welcomeMessage = `👋 Welcome, ${user.name}! Please select your role to proceed:`;
        menu = loginMenu;
    }

    await ctx.reply(welcomeMessage, menu);
}
  } catch (error) {
    console.error('Error in /start command:', error);
    await ctx.reply('⚠️ An error occurred. Please try again later.');
  }
});

bot.action(/link_yes_(\d+)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const parentId = ctx.match[1];
    const studentId = ctx.match[2];

    const parent = await User.findOne({ telegramId: parentId, role: 'parent' });
    const student = await Student.findOne({ studentId });

    if (!parent || !student) {
        return ctx.reply('🛑 Parent or student not found.');
    }

    if (parent.studentIds.length >= 3) {
        await ctx.telegram.sendMessage(
            parentId,
            '🛑 Linking denied. You can only link up to 3 students.',
            { parse_mode: "HTML" }
        );
        return ctx.reply('⚠️ Linking denied: Parent already has 3 linked students.');
    }

    student.parentId = parentId;
    student.pendingParentId = null;
    await student.save();

    if (!parent.studentIds.includes(studentId)) {
        parent.studentIds.push(studentId);
    }
    parent.pendingStudentIds = parent.pendingStudentIds.filter(id => id !== studentId);
    await parent.save();

    await ctx.telegram.sendMessage(
        parentId,
        `✅ Your request to register as parent of ${student.name} (${student.studentId}) was approved.\n\n` +
        `🎉 Welcome! You can now access the parent menu below 👇`,
        {
            parse_mode: "HTML",
            reply_markup: parentMenu.reply_markup   // 👈 send the parent menu directly
        }
    );

    ctx.reply(`✅ You approved linking ${student.name} (${student.studentId}) to ${parent.name}.`);
});

bot.action(/link_no_(\d+)_(.+)/, async (ctx) => {
    await ctx.answerCbQuery();
    const parentId = ctx.match[1];
    const studentId = ctx.match[2];

    const parent = await User.findOne({ telegramId: parentId, role: 'parent' });
    const student = await Student.findOne({ studentId });

    if (student) {
        student.pendingParentId = null;   // clear pending parent
        await student.save();
    }

    if (parent) {
        parent.pendingStudentIds = parent.pendingStudentIds.filter(id => id !== studentId); // remove from pending list
        await parent.save();
    }

    if (parent) {
        await ctx.telegram.sendMessage(
            parentId,
            `🛑 Your request to link ${student ? student.name : 'student'} (${studentId}) was denied.`,
            { parse_mode: "HTML" }
        );
    }

    ctx.reply('🛑 You denied the link request.');
});


async function cleanAndNotifyAdmins(ctx, requestId, request, teacherName, approverName) {

    const approval = await ApprovalMessage.findOne({ type: 'student_list', requestId });
    const currentAdminId = ctx.from.id;

    if (!approval) {
        console.warn(`ApprovalMessage not found for type 'student_list' and requestId ${requestId}`);
        if (typeof clearApprovalMessages === 'function') {
            await clearApprovalMessages("student_list", requestId, true);
        }
        return;
    }

    const notificationText =
        `✅ <b>REQUEST APPROVED</b> for <b>${teacherName}</b>.\n\n` +
        `📚 Class: <b>${request.className}</b>\n` +
        `📖 Subject: <b>${request.subject}</b>\n\n` +
        `👤 Approved by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString()}`;

    for (const msg of approval.messages) {
        try {
            await ctx.telegram.deleteMessage(msg.adminId, msg.messageId);

            if (msg.adminId !== currentAdminId) {
                await ctx.telegram.sendMessage(
                    msg.adminId,
                    notificationText,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (err) {
            console.error(`Failed to process message for admin ${msg.adminId} (message ${msg.messageId}):`, err.message);
        }
    }

    if (typeof clearApprovalMessages === 'function') {
        await clearApprovalMessages("student_list", requestId, true);
    }
}


async function denyAndNotifyAdmins(ctx, requestId, request, teacherName, approverName) {

    const approval = await ApprovalMessage.findOne({ type: 'student_list', requestId });
    const currentAdminId = ctx.from.id;

    if (!approval) {
        console.warn(`ApprovalMessage not found for type 'student_list' and requestId ${requestId}`);
        if (typeof clearApprovalMessages === 'function') {
            await clearApprovalMessages("student_list", requestId, true);
        }
        return;
    }

    const notificationText =
        `🛑 <b>REQUEST DENIED</b> for <b>${teacherName}</b>.\n\n` +
        `📚 Class: <b>${request.className}</b>\n` +
        `📖 Subject: <b>${request.subject}</b>\n\n` +
        `👤 Denied by: <b>${approverName}</b>\n` +
        `⏰ ${new Date().toLocaleString()}`;

    for (const msg of approval.messages) {
        try {
            await ctx.telegram.deleteMessage(msg.adminId, msg.messageId);

            if (msg.adminId !== currentAdminId) {
                await ctx.telegram.sendMessage(
                    msg.adminId,
                    notificationText,
                    { parse_mode: 'HTML' }
                );
            }
        } catch (err) {
            console.error(`Failed to process message for admin ${msg.adminId} (message ${msg.messageId}):`, err.message);
        }
    }

    if (typeof clearApprovalMessages === 'function') {
        await clearApprovalMessages("student_list", requestId, true);
    }
}



bot.action(/^approve_request_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('Approving request...');
    const requestId = ctx.match[1];

    try {
        const request = await StudentListRequest.findById(requestId);
        if (!request) {
            return ctx.reply('🛑 Request not found or already processed.');
        }

        const admin = await getUserById(ctx.from.id);
        const approverName = admin?.name || ctx.from.first_name || ctx.from.username || 'An Admin';

        const teacher = await Teacher.findOne({ teacherId: request.teacherId });
        const teacherName = teacher ? teacher.name : 'Teacher';

        await cleanAndNotifyAdmins(ctx, requestId, request, teacherName, approverName);

        const students = await Student.find({ class: request.className }).sort({ name: 1 });
        if (students.length === 0) {
            await ctx.reply(`🛑 No students found in class ${request.className}.`);
            return;
        }

        const total = students.length;
        const startTime = Date.now();
        const teacherMessage = await ctx.telegram.sendMessage(
            request.teacherTelegramId,
            `📋 Your student list request for class ${request.className} (subject: ${request.subject}) is being processed...`,
            { parse_mode: 'HTML' }
        );

        const relationshipsToInsert = [];
        const existingRelations = await TeacherStudent.find({
            teacherId: request.teacherId,
            className: request.className,
            subject: request.subject
        }).lean();
        const existingIds = new Set(existingRelations.map(r => r.studentId));

        for (const student of students) {
            if (!existingIds.has(student.studentId)) {
                relationshipsToInsert.push({
                    teacherId: request.teacherId,
                    teacherName,
                    studentId: student.studentId,
                    studentName: student.name,
                    subject: request.subject,
                    className: request.className,
                    addedDate: new Date()
                });
            }
        }

        let successfulInserts = 0;
        for (const relation of relationshipsToInsert) {
            try {
                await TeacherStudent.create(relation);
                successfulInserts++;
            } catch (e) {
                console.warn('Insert failed for', relation.studentId, e.message);
            }
        }

        request.status = 'approved';
        request.approvedBy = ctx.from.id;
        request.approvalDate = new Date();
        await request.save();

        await ctx.telegram.sendMessage(
            request.teacherTelegramId,
            `✅ Your student list request has been approved by <b>${approverName}</b>!\n\n` +
            `📚 Class: ${request.className}\n📖 Subject: ${request.subject}\n` +
            `👨‍🏫 Teacher: ${teacherName}\n\n` +
            `📊 Students processed: ${successfulInserts}/${total}\n` +
            `⏱ Time taken: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
            { parse_mode: 'HTML' }
        );

        await logAdminAction(ctx, 'APPROVE_STUDENT_LIST', {
            requestId,
            class: request.className,
            subject: request.subject,
            teacherId: request.teacherId,
            teacherName,
            totalStudents: total,
            successfulInserts,
            approvedBy: approverName,
            approvedAt: new Date()
        });

        const master = await User.findOne({ role: 'masterAdmin' });
        if (master) {
            await ctx.telegram.sendMessage(
                master.telegramId,
                `📋 <b>Student List Approval Notice</b>\n\n` +
                `👨‍🏫 Teacher: <b>${teacherName}</b> (ID: ${teacher.teacherId})\n` +
                `📚 Class: <b>${request.className}</b>\n📖 Subject: <b>${request.subject}</b>\n` +
                `✅ Approved by: <b>${approverName}</b>\n` +
                `🕒 ${new Date().toLocaleString()}`,
                { parse_mode: 'HTML' }
            );
        }

        await ctx.replyWithHTML(`✅ You approved student list request for <b>${teacherName}</b>.`);

    } catch (error) {
        console.error('Error approving student list request:', error);
        await ctx.reply('🛑 An error occurred while approving the student list request.');
    }
});

bot.hears('👥 Total Users', async (ctx) => {
  await showTotalUsersDashboard(ctx);
});

bot.action('refresh_total_users', async (ctx) => {
  await ctx.answerCbQuery('🔄 Refreshing...');
  await showTotalUsersDashboard(ctx, true);
});
async function showTotalUsersDashboard(ctx, isRefresh = false) {
  try {
    const masterAdminId = String(process.env.MASTER_ADMIN_ID);

    if (String(ctx.from.id) !== masterAdminId) {
      await ctx.reply('🛑 Unauthorized: Only the master admin can view user statistics.');
      return;
    }

    const users = await User.find({});
    const students = await Student.find({});

    const totalTeachers = users.filter(u => u.role === 'teacher').length;
    const totalParents = users.filter(u => u.role === 'parent' || u.role === 'parentAM').length;
    const totalAdmins = users.filter(u => u.role === 'admin').length;
    const totalMasterAdmins = users.filter(u => u.role === 'masterAdmin').length;
    const totalUsers = users.filter(u =>
      !['teacher', 'parent', 'parentAm', 'student', 'admin', 'masterAdmin'].includes(u.role)
    ).length;
    const totalStudents = students.length;
    const grandTotal = users.length + students.length;

    const makeBar = (count, total) => {
      const maxBars = 10;
      const barCount = total > 0 ? Math.round((count / total) * maxBars) : 0;
      return '*'.repeat(barCount) + '▫️'.repeat(maxBars - barCount);
    };

    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour12: false });

    const message = `
👥 <b>Total Users Dashboard</b>

🧑‍🏫 <b>Teachers:</b> ${totalTeachers} ${makeBar(totalTeachers, grandTotal)} (${((totalTeachers / grandTotal) * 100 || 0).toFixed(1)}%)
👨‍👩‍👧 <b>Parents:</b> ${totalParents} ${makeBar(totalParents, grandTotal)} (${((totalParents / grandTotal) * 100 || 0).toFixed(1)}%)
🧑‍🎓 <b>Students:</b> ${totalStudents} ${makeBar(totalStudents, grandTotal)} (${((totalStudents / grandTotal) * 100 || 0).toFixed(1)}%)
🧑‍💼 <b>Admins:</b> ${totalAdmins} ${makeBar(totalAdmins, grandTotal)} (${((totalAdmins / grandTotal) * 100 || 0).toFixed(1)}%)
👑 <b>Master Admins:</b> ${totalMasterAdmins} ${makeBar(totalMasterAdmins, grandTotal)} (${((totalMasterAdmins / grandTotal) * 100 || 0).toFixed(1)}%)
👤 <b>Regular Users:</b> ${totalUsers} ${makeBar(totalUsers, grandTotal)} (${((totalUsers / grandTotal) * 100 || 0).toFixed(1)}%)

📊 <b>Total:</b> ${grandTotal}
${isRefresh ? `🔄 <i>Last updated at ${timeString}</i>` : ''}${isRefresh ? '\u200B' : ''}
`;

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 Refresh', 'refresh_total_users')],
      [Markup.button.callback('⬅️ Back to Menu', 'back_to_master_menu')]
    ]);

    if (isRefresh) {
      try {
        await ctx.editMessageText(message, { parse_mode: 'HTML', ...buttons });
      } catch (err) {
        if (err.description?.includes('message is not modified')) {
          await ctx.replyWithHTML(message, buttons);
        } else {
          throw err;
        }
      }
    } else {
      await ctx.replyWithHTML(message, buttons);
    }

    

  } catch (error) {
    console.error('Error fetching user totals:', error);
    await ctx.reply('🛑 Error fetching user totals. Please try again later.', masterAdminMenu);
   
  }
}

bot.action('back_to_master_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('🏠 Master Admin Menu:', masterAdminMenu);
});


bot.hears('📢 Announce to Students', requireTeacherAuth, (ctx) => ctx.scene.enter('announce_students_scene'));


bot.hears('⛓️‍💥 ተማሪ ለይ', (ctx) => {
  ctx.scene.enter('parent_unlink_scene_am');

});
bot.hears('❓ እገዛ/ትምህርት ቤትን ያነጋግሩ', async (ctx) => {
    try {
       
        

        const helpMessage = `
📖 የወላጅ እገዛ

👨‍👩‍👧 እንደ ወላጅ፣ ይህን ቦት ለመጠቀም ይችላሉ:
• ልጆችዎን ከመለያዎ ጋር ማገናኘት
• ውጤቶቻቸውን እና እድገታቸውን መመልከት
• የዕለት ተዕለት መገኘትን መከታተል
• ጠቃሚ ማሳወቂያዎችን መቀበል

🏫 የትምህርት ቤት ዕውቂያ መረጃ:
📍 አድራሻ: አዲስ አበባ፣ ኢትዮጵያ  
☎️ ስልክ: +251-11-123-4567  
📧 ኢሜይል: info@yourschool.edu

            በ Identity © 2025 የተጎላበተ።

ችግሮች ካጋጠሙዎት፣ እባክዎ የትምህርት ቤት አስተዳደርን ያነጋግሩ።
        `;

        ctx.replyWithMarkdown(helpMessage, parentMenuAm);
    } catch (error) {
        console.error('Error showing parent help menu:', error);
        ctx.reply('🛑 እገዛ በመክፈት ላይ ስህተት ተከስቷል።');
    }
});



bot.hears('📅 የቀሩበት ቀን', async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: userId });

    if (!user) {
      return ctx.reply('🚫 You are not registered in the system. Please use /start first.');
    }

    const students = await Student.find({ parentId: userId });
    if (!students.length) {
      return ctx.reply(
        'INFO: No students linked to your account.\n\n' +
        'To link your child:\n' +
        '1. Use "🔗 Link Student" option\n' +
        '2. Enter your child\'s Student ID\n' +
        '3. Wait for admin approval'
      );
    }

    if (user.role !== 'parentAm') {
      await User.updateOne({ telegramId: userId }, { $set: { role: 'parentAm' } });
    }

    ctx.session = ctx.session || {};
    ctx.session.attendancePagesAm = {}; // page tracking per student

    for (const student of students) {
      ctx.session.attendancePagesAm[student.studentId] = 0;
      await sendAttendancePageAm(ctx, student);
    }

  } catch (error) {
    console.error('Error fetching attendance records:', error);
    ctx.reply('🛑 Error fetching attendance records.');
  }
});

async function sendAttendancePageAm(ctx, student) {
  try {
    const pageSize = 5;
    const page = ctx.session.attendancePagesAm[student.studentId] || 0;
    let message = `👶 <b>${student.name}</b> (${student.studentId})\n🏫 ክፍል: ${student.class || 'N/A'}\n\n`;

    const allAttendances = await Attendance.find({
      students: { $elemMatch: { studentId: student.studentId, status: "absent" } }
    });

    const sorted = allAttendances.sort((a, b) => new Date(b.date) - new Date(a.date));

    const start = page * pageSize;
    const records = sorted.slice(start, start + pageSize);

    if (!records.length && page === 0) {
      message += '✅ ልጅዎ ሁሉንም ቀን ተገኝቱዎል/ለች 🎉';
    } else if (!records.length) {
      message += '📭 የቀጣይ መዝገብ የለም።';
    } else {
      message += `📊 <b>የቀሩበት ቀን:</b>\n`;
      records.forEach((att, i) => {
        const studentAtt = att.students.find(s => s.studentId === student.studentId && s.status === 'absent');
        if (studentAtt) {
          const date = new Date(att.date);
          const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
          });

          message += `\n<b>#${start + i + 1}</b>\n`;
          message += `📅 ቀን: <b>${formattedDate}</b>\n`;
          message += `📚 ትምህርት: <i>${att.subject}</i>\n`;
          message += `🎯 ሁኔታ: 🛑 <b>ቀሪ</b>\n`;
        }
      });
    }

    const buttons = [];
    if (page > 0) buttons.push(Markup.button.callback('⬅️ ቀድሞ', `attendance_prevAm_${student.studentId}`));
    if (start + pageSize < sorted.length) buttons.push(Markup.button.callback('➡️ ቀጣይ', `attendance_nextAm_${student.studentId}`));
    buttons.push(Markup.button.callback('ዝጋ', `attendance_closeAm_${student.studentId}`));

    await ctx.replyWithHTML(message, Markup.inlineKeyboard([buttons]));

  } catch (err) {
    console.error('Error in sendAttendancePageAm:', err);
    await ctx.reply('🛑 Failed to load attendance records.');
  }
}

bot.action(/^attendance_nextAm_(.+)$/, async (ctx) => {
  const studentId = ctx.match[1];
  ctx.session.attendancePagesAm[studentId]++;
  await ctx.editMessageText('⏳ ወደ ቀጣይ ገፅ...', { parse_mode: 'HTML' });
  const student = ctx.session.students.find(s => s.studentId === studentId);
  await sendAttendancePageAm(ctx, student);
  await ctx.answerCbQuery();
});

bot.action(/^attendance_prevAm_(.+)$/, async (ctx) => {
  const studentId = ctx.match[1];
  if (ctx.session.attendancePagesAm[studentId] > 0) {
    ctx.session.attendancePagesAm[studentId]--;
  }
  await ctx.editMessageText('⏳ ወደ ቀድሞ ገፅ...', { parse_mode: 'HTML' });
  const student = ctx.session.students.find(s => s.studentId === studentId);
  await sendAttendancePageAm(ctx, student);
  await ctx.answerCbQuery();
});

bot.action(/^attendance_closeAm_(.+)$/, async (ctx) => {
  await ctx.editMessageText('📁 መዝገቡ ተዘግቷል።');
  await ctx.answerCbQuery();
});




bot.hears('🔗 ሌላ ተማሪ አገናኝ', (ctx) => {
    ctx.scene.enter('link_another_student_scene_am');
});

bot.hears('📚 ቱተር ጠይቅ', (ctx) => {
  ctx.scene.enter('parent_request_tutor_scene_am'); // duplicated Amharic scene
});

bot.hears('📩 አስተማሪ ያግኙ', (ctx) => {
    ctx.scene.enter('contact_teachers_scene_am');
});

bot.hears('💯 ውጤቶች ይመልከቱ', async (ctx) => {
    const user = await getUserById(ctx.from.id.toString());
        try {
            const students = await getStudentsByParentId(user.telegramId);
            if (students.length === 0) {
                return ctx.reply('🛑 ከምንም ተማሪ ጋር አልተገናኙም።', parentMenuAm);
            }

            let fullGradeList = '📋 <b>የልጅዎ(ች) ውጤቶች</b>\n\n';

            for (const student of students) {
                const result = await viewStudentGrades(student.studentId);
                if (!result) continue;

                fullGradeList += `<b>👤 ${student.name}</b> (ክፍል: ${student.class || 'የለም'})\n`;

                if (result.grades.length === 0) {
                    fullGradeList += '   📉 ውጤቶች አልተገኙም።\n\n';
                } else {
                    // Group grades by subject
                    const gradesBySubject = {};
                    result.grades.forEach(grade => {
                        if (!gradesBySubject[grade.subject]) {
                            gradesBySubject[grade.subject] = [];
                        }
                        gradesBySubject[grade.subject].push(grade);
                    });

                    for (const [subject, subjectGrades] of Object.entries(gradesBySubject)) {
                        fullGradeList += `  <b>📚 ${subject}</b>\n`;
                        subjectGrades.forEach(gradeInfo => {
                            fullGradeList += `    • ውጤት: ${gradeInfo.score} | ዓላማ: ${gradeInfo.purpose} | ቀን: ${new Date(gradeInfo.date).toLocaleDateString('am-ET')}\n`;
                        });
                    }
                    fullGradeList += '\n';
                }
                fullGradeList += '──────────────────\n';
            }

            return ctx.replyWithHTML(fullGradeList, parentMenuAm);
        } catch (error) {
            console.error('Error viewing grades:', error);
            ctx.reply('🛑 ውጤቶችን ለማምጣት ስህተት ተከስቷል።', parentMenuAm);
        }
    
});


bot.hears('📩 Contact Teacher', async (ctx) => {
  
  return ctx.scene.enter('contact_teachers_scene');
});


bot.hears(['🌐 Change Language', '🌐 ቋንቋ ቀይር'], async (ctx) => {
  try {
    const telegramId = String(ctx.from.id);
    const user = await User.findOne({ telegramId });

    if (!user) {
      return ctx.reply('🛑 Profile not found.');
    }

    const student = await Student.findOne({ parentId: telegramId });
    const hasStudent = !!student;

    if (!hasStudent) {
      return ctx.reply('ℹ️ This option is only available for parents with registered students.');
    }

    const role = (user.role || '').toLowerCase();

    if (role === 'parent') {
      user.role = 'parentAm';
      await user.save();
      return ctx.reply('✅ ቋንቋ ወደ አማርኛ ተቀይሯል።', parentMenuAm);
    }

    if (role === 'parentam' || role === 'parent_am') {
      user.role = 'parent';
      await user.save();
      return ctx.reply('✅ Language switched to English.', parentMenu);
    }

    user.role = 'parent';
    await user.save();
    return ctx.reply(
      '✅ Language setting enabled — you are now set as a parent. Press again to switch to Amharic.',
      parentMenu
    );

  } catch (error) {
    console.error('Error changing language:', error);
    ctx.reply('⚠️ Something went wrong while switching language. Please try again later.');
  }
});




bot.hears('📜 FAQ', (ctx) => {
  ctx.replyWithHTML(
    `
📖 <b>Frequently Asked Questions (Parents)</b>
━━━━━━━━━━━━━━━━━━━━━

1️⃣ <b>How do I register as a parent?</b>  
👩‍👩‍👦 Go to <b>Parent Registration</b> in the login menu and follow the instructions.

2️⃣ <b>How do I link my child’s account?</b>  
🔗 After registration, choose <b>Link Student</b> and enter your child’s Student ID (e.g., ST1234).  
The admin will review and approve your request.

3️⃣ <b>Can I unlink a student?</b>  
🛑 Yes, you can request to unlink your child if needed. Use the <b>Unlink Student</b> option.

4️⃣ <b>How do I request a tutor?</b>  
📚 Go to <b>Request Tutor</b> and choose the subject. Available freelance teachers will be displayed with their rates, hours/day, and days/week. Confirm to send a request.

5️⃣ <b>How will I know if my tutor request is accepted?</b>  
📢 You will receive a confirmation message once the teacher accepts your request.  

6️⃣ <b>What if I face problems?</b>  
🛠 For support, contact an admin or send your issue via the bot — it will be forwarded directly to the support team.

━━━━━━━━━━━━━━━━━━━━━
💡 <i>Tip:</i> Use the main menu buttons for quick navigation at any time.
    `,
    loginMenu
  );
});

bot.hears('ℹ️ About Us', (ctx) => {
  ctx.replyWithHTML(
    `
🏢 <b>About Our Company</b>
━━━━━━━━━━━━━━━━━━━━━
🌍 <b>Who We Are</b>
        <b>Identity</b>
We are an innovative EdTech company dedicated to transforming education through digital platforms. Our mission is to empower teachers, parents, and students with modern tools that enhance learning and simplify school management.

🚀 <b>What We Do</b>
• Provides digital attendance, grades, and performance tracking  
• Supports multiple languages including Amharic  

💡 <b>Our Vision</b>
To inspire and innovate the education ecosystem across Ethiopia and beyond by bridging technology and learning.

🤝 <b>Our Values</b>
• Innovation  
• Integrity  
• Collaboration  
• Excellence  

📞 <b>Contact Us</b>
• Telegram: @Identityxbot 
• Email: Identityxlabs@gmail.com  
• Phone Line 1 : +251961011887 
• Phone Line 2 : +251910105852  

━━━━━━━━━━━━━━━━━━━━━
<b>Innovate • Transform • Inspire</b>
    `,
    loginMenu 
  );
});


bot.hears('📜 My Freelance', requireTeacherAuth, (ctx) => {
  ctx.scene.enter('teacher_manage_freelance_scene');
});

bot.hears('💼 Freelance', requireTeacherAuth, (ctx) => ctx.scene.enter('teacher_freelance_scene'));
bot.hears('📚 Request a Tutor', (ctx) => ctx.scene.enter('parent_request_tutor_scene'));

bot.hears('❓ Help', async (ctx) => {
    const user = await User.findOne({ telegramId: ctx.from.id.toString() });
    if (!user) {
        await ctx.reply('🛑 Please log in to access help.');
        return;
    }
    await ctx.reply('📚 Fetching help information...', { reply_markup: { remove_keyboard: true } });
    await ctx.scene.enter('help_scene');
});

// Master Admin Menu Handlers //
//
///
//
//
//
//
//
//
//


bot.hears('🔍 Admin Details', async (ctx) => {
   
    await ctx.scene.enter('admin_details_scene');
});



bot.hears('📢 Broadcast Message/Ad', async (ctx) => {
    await ctx.scene.enter('broadcastScene');
});



bot.hears('🛡 Contact an Admin', async (ctx) => {
    
    await ctx.scene.enter('contact_admin_scene');
});
bot.hears('👑 View All Admins', requireMasterAdmin, (ctx) => {
    ctx.scene.enter('view_all_admins_scene');
});

bot.hears('🚫 Remove Admin', requireMasterAdmin, (ctx) => {
    ctx.scene.enter('remove_admin_scene');
});


bot.hears('📊 Admin Activities', async (ctx) => {
  try {
    let logs = await ActivityLog.find();

    if (!logs || logs.length === 0) {
      return ctx.reply('ℹ️ No admin activities logged yet.');
    }

    logs = logs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    let message = '✨ <b>Recent Admin Activities</b> ✨\n\n';

    logs.forEach((log, idx) => {
      const time = new Date(log.timestamp).toLocaleString();

      let actionIcon = '🔧';
      if (log.action.includes('DELETE')) actionIcon = '🗑️';
      else if (log.action.includes('UPLOAD')) actionIcon = '📤';
      else if (log.action.includes('REMOVE')) actionIcon = '🛑';
      else if (log.action.includes('ADD')) actionIcon = '➕';
      else if (log.action.includes('UPDATE')) actionIcon = '📝';
      else if (log.action.includes('SEARCH')) actionIcon = '🔍';
      else if (log.action.includes('ANNOUNCEMENT')) actionIcon = '📢';

      message += `━━━━━━━━━━━━━━━━━━━\n`;
      message += `#${idx + 1} | 🕒 <b>${time}</b>\n`;
      message += `👤 <b>${log.adminName}</b> (<code>${log.adminId}</code>)\n`;
      message += `${actionIcon} <b>Action:</b> ${log.action}\n`;

      if (log.details && Object.keys(log.details).length > 0) {
        message += `📋 <b>Details:</b>\n`;
        for (const [key, value] of Object.entries(log.details)) {
          message += `   • ${key}: ${value}\n`;
        }
      } else {
        message += `📋 <b>Details:</b> None\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━━\n\n`;
    });

    await ctx.replyWithHTML(
      message,
      Markup.inlineKeyboard([
        [Markup.button.callback('📜 Full Activity Log', 'view_full_log')]
      ])
    );
  } catch (err) {
    console.error('🛑 Error fetching admin activities:', err);
    ctx.reply('🛑 Failed to load admin activities.');
  }
});


bot.action('view_full_log', async (ctx) => {
  await ctx.answerCbQuery();
  try {
    const logFilePath = path.join(process.cwd(), 'activity.log');

    if (!fs.existsSync(logFilePath)) {
      return ctx.reply('ℹ️ No activity.log file found.');
    }

    const fileContents = fs.readFileSync(logFilePath, 'utf8');

    if (fileContents.length > 4000) {
      const tempFile = path.join(process.cwd(), 'admin_full_activity.txt');
      fs.writeFileSync(tempFile, fileContents, 'utf8');
      await ctx.replyWithDocument({ source: tempFile, filename: 'admin_full_activity.txt' });
      fs.unlinkSync(tempFile);
    } else {
      await ctx.replyWithHTML(`<b>📜 Full Admin Activity Log (from file)</b>\n\n<pre>${fileContents}</pre>`, { parse_mode: "HTML" });
    }

  } catch (err) {
    console.error('🛑 Error fetching full log:', err);
    ctx.reply('🛑 Failed to load full admin activity log.');
  }
});

bot.hears('📝 Promote to Admin', requireMasterAdmin, (ctx) => {
    ctx.scene.enter('promote_admin_scene');
});

bot.hears('⬅️ Back to Main', requireMasterAdmin, (ctx) => {
    ctx.reply('Returning to main menu...', loginMenu);
});


bot.hears('⛓️‍💥 Unlink a Student', (ctx) => {
    ctx.scene.enter('parent_unlink_scene');
});

bot.hears('👤 Parent Signup/Login', async (ctx) => {
  ctx.scene.enter('register_parent_scene');
});
bot.hears('📅 View Attendance', async (ctx) => {
  try {
    const userId = ctx.from.id.toString();
    const user = await User.findOne({ telegramId: userId });

    if (!user) {
      return ctx.reply('🚫 You are not registered in the system. Please use /start first.');
    }

    const students = await Student.find({ parentId: userId });
    if (!students.length) {
      return ctx.reply(
        'INFO: No students linked to your account.\n\n' +
        'To link your child:\n' +
        '1. Use "🔗 Link Student" option\n' +
        '2. Enter your child\'s Student ID\n' +
        '3. Wait for admin approval.'
      );
    }

    if (user.role !== 'parent') {
      await User.updateOne({ telegramId: userId }, { $set: { role: 'parent' } });
    }

    ctx.session = ctx.session || {};
    ctx.session.attendancePages = {}; // studentId -> page index
    ctx.session.students = students;

    for (const student of students) {
      ctx.session.attendancePages[student.studentId] = 0;
      await sendAttendancePage(ctx, student);
    }

  } catch (error) {
    console.error('Error fetching attendance records:', error);
    ctx.reply('🛑 Error fetching attendance records.');
  }
});

async function sendAttendancePage(ctx, student) {
  try {
    const pageSize = 5;
    const page = ctx.session.attendancePages[student.studentId] || 0;
    let message = `👶 <b>${student.name}</b> (${student.studentId})\n🏫 Class: ${student.class || 'N/A'}\n\n`;

    const allAttendances = await Attendance.find({
      students: { $elemMatch: { studentId: student.studentId, status: "absent" } }
    });

    const sorted = allAttendances.sort((a, b) => new Date(b.date) - new Date(a.date));

    const start = page * pageSize;
    const records = sorted.slice(start, start + pageSize);

    if (!records.length && page === 0) {
      message += '✅ No absences recorded. Great job maintaining perfect attendance! 🎉';
    } else if (!records.length) {
      message += '📭 No more records found.';
    } else {
      message += `📊 <b>Recent Absences:</b>\n`;

      records.forEach((att, i) => {
        const studentAtt = att.students.find(s => s.studentId === student.studentId && s.status === 'absent');
        if (studentAtt) {
          const date = new Date(att.date);
          const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
          });

          message += `\n<b>#${start + i + 1}</b>\n`;
          message += `📅 Date: <b>${formattedDate}</b>\n`;
          message += `📚 Subject: <i>${att.subject}</i>\n`;
          message += `🎯 Status: 🛑 <b>Absent</b>\n`;
        }
      });
    }

    const buttons = [];
    if (page > 0) buttons.push(Markup.button.callback('⬅️ Previous', `attendance_prev_${student.studentId}`));
    if (start + pageSize < sorted.length) buttons.push(Markup.button.callback('➡️ Next', `attendance_next_${student.studentId}`));
    buttons.push(Markup.button.callback('close', `attendance_close_${student.studentId}`));

    await ctx.replyWithHTML(message, Markup.inlineKeyboard([buttons]));

  } catch (err) {
    console.error('Error in sendAttendancePage:', err);
    await ctx.reply('🛑 Failed to load attendance records.');
  }
}

bot.action(/^attendance_next_(.+)$/, async (ctx) => {
  const studentId = ctx.match[1];
  ctx.session.attendancePages[studentId]++;
  await ctx.editMessageText('⏳ Loading next records...', { parse_mode: 'HTML' });
  const student = ctx.session.students.find(s => s.studentId === studentId);
  await sendAttendancePage(ctx, student);
  await ctx.answerCbQuery();
});

bot.action(/^attendance_prev_(.+)$/, async (ctx) => {
  const studentId = ctx.match[1];
  if (ctx.session.attendancePages[studentId] > 0) ctx.session.attendancePages[studentId]--;
  await ctx.editMessageText('⏳ Loading previous records...', { parse_mode: 'HTML' });
  const student = ctx.session.students.find(s => s.studentId === studentId);
  await sendAttendancePage(ctx, student);
  await ctx.answerCbQuery();
});

bot.action(/^attendance_close_(.+)$/, async (ctx) => {
  await ctx.editMessageText('🛑 Attendance view closed.');
  await ctx.answerCbQuery();
});

bot.hears('📝 Record Attendance', requireTeacherAuth, async (ctx) => {
    try {
        const user = await User.findOne({ telegramId: ctx.from.id });
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        
        if (!user || user.role !== 'teacher' || !teacher) {
            return ctx.reply('🛑 Teacher access required. Please make sure you are registered as a teacher.', loginMenu);
        }
        
        ctx.scene.enter('teacher_attendance_scene');
    } catch (error) {
        console.error('Error checking teacher access:', error);
        ctx.reply('🛑 An error occurred. Please try again.', loginMenu);
    }
});
bot.hears('🗑️ Delete Class', async (ctx) => {
   
    ctx.scene.enter('delete_class_scene');
});
bot.hears('🚫 Ban/Unban Teacher', async (ctx) => {
  const user = await getUserById(ctx.from.id);
  if (!user || user.role !== 'admin') {
    return ctx.reply('🛑 You are not authorized to use this feature.');
  }
  const teachers = await Teacher.find().sort({ name: 1 });
  if (teachers.length === 0) {
    return ctx.reply('No teachers found.');
  }

  const buttons = teachers.map(teacher => [
    Markup.button.callback(
      `${teacher.name} (${teacher.teacherId}) - ${teacher.banned ? 'Unban' : 'Ban'}`,
      `${teacher.banned ? 'unban' : 'ban'}_${teacher.teacherId}`
    )
  ]);

  buttons.push([Markup.button.callback('🛑 Cancel', 'cancel_ban_unban')]);

  ctx.reply('Select a teacher to ban or unban:', Markup.inlineKeyboard(buttons));
});

bot.hears('🗑 Remove Class', requireTeacherAuth, async (ctx) => {
  await ctx.scene.enter('teacher_remove_class_scene');
});


bot.action(/^ban_(.+)$/, async (ctx) => {
  try {
    const teacherId = ctx.match[1];
    await ctx.answerCbQuery();

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) {
      return ctx.reply('🛑 Teacher not found.');
    }

    if (teacher.banned) {
      return ctx.reply(`⚠️ Teacher ${teacher.name} is already banned.`);
    }

    teacher.banned = true;
    await teacher.save();

    if (teacher.telegramId) {
      const user = await getUserById(teacher.telegramId);
      if (user) {
        user.banned = true;
        await user.save();
      }
    }

    await logAdminAction(ctx, 'BAN_TEACHER', {
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      admin: ctx.from.first_name || ctx.from.username || 'Unknown',
      adminId: ctx.from.id,
    });

    if (ctx.from.id.toString() !== process.env.MASTER_ADMIN_ID) {
      await notifyMasterAdmin(ctx, 'teacher_banned', {
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        adminName: ctx.from.first_name || 'Admin',
        adminId: ctx.from.id,
        date: new Date().toLocaleString()
      });
    }

    if (teacher.telegramId) {
      try {
        await ctx.telegram.sendMessage(
          teacher.telegramId,
          `⚠️ <b>Account Banned</b>\n\n` +
          `Your account has been banned from using the School System Bot.\n\n` +
          `🧑🏫 Teacher: ${teacher.name}\n` +
          `🆔 ID: ${teacher.teacherId}\n` +
          `📅 Date: ${new Date().toLocaleString()}\n\n` +
          `📧 For more information, please contact the school administration.`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error(`Failed to notify teacher ${teacherId} of ban:`, error);
      }
    }

    ctx.reply(`✅ Teacher ${teacher.name} (${teacherId}) has been banned from accessing the bot.`);

  } catch (error) {
    console.error('Error banning teacher:', error);

    await logAdminAction(ctx, 'BAN_TEACHER_ERROR', {
      teacherId: ctx.match[1],
      error: error.message,
      admin: ctx.from.first_name || ctx.from.username || 'Unknown',
      adminId: ctx.from.id,
      date: new Date().toISOString()
    });

    ctx.reply('🛑 An error occurred while banning the teacher.');
  }
});


bot.action(/^unban_(.+)$/, async (ctx) => {
  try {
    const teacherId = ctx.match[1];
    await ctx.answerCbQuery();

    const teacher = await Teacher.findOne({ teacherId });
    if (!teacher) {
      return ctx.reply('🛑 Teacher not found.');
    }

    if (!teacher.banned) {
      return ctx.reply(`⚠️ Teacher ${teacher.name} is not banned.`);
    }

    teacher.banned = false;
    await teacher.save();

    if (teacher.telegramId) {
      const user = await getUserById(teacher.telegramId);
      if (user) {
        user.banned = false;
        await user.save();
      }
    }

    await logAdminAction(ctx, 'UNBAN_TEACHER', {
      teacherId: teacher.teacherId,
      teacherName: teacher.name,
      admin: ctx.from.first_name || ctx.from.username || 'Unknown',
      adminId: ctx.from.id,
    });

    if (ctx.from.id.toString() !== process.env.MASTER_ADMIN_ID) {
      await notifyMasterAdmin(ctx, 'teacher_unbanned', {
        teacherId: teacher.teacherId,
        teacherName: teacher.name,
        adminName: ctx.from.first_name || 'Admin',
        adminId: ctx.from.id,
        date: new Date().toLocaleString()
      });
    }

    if (teacher.telegramId) {
      try {
        await ctx.telegram.sendMessage(
          teacher.telegramId,
          `✅ <b>Account Unbanned</b>\n\n` +
          `Your account has been restored. You can now access the School System Bot again.\n\n` +
          `🧑🏫 Teacher: ${teacher.name}\n` +
          `🆔 ID: ${teacher.teacherId}\n` +
          `📅 Date: ${new Date().toLocaleString()}\n\n` +
          `🎉 Welcome back! Use /start to access the bot.`,
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error(`Failed to notify teacher ${teacherId} of unban:`, error);
      }
    }

    ctx.reply(`✅ Teacher ${teacher.name} (${teacherId}) has been unbanned and can now access the bot.`);

  } catch (error) {
    console.error('Error unbanning teacher:', error);

    await logAdminAction(ctx, 'UNBAN_TEACHER_ERROR', {
      teacherId: ctx.match[1],
      error: error.message,
      admin: ctx.from.first_name || ctx.from.username || 'Unknown',
      adminId: ctx.from.id,
      date: new Date().toISOString()
    });

    ctx.reply('🛑 An error occurred while unbanning the teacher.');
  }
});


bot.action('cancel_ban_unban', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.reply('Ban/unban operation cancelled.', adminMenu);
});

bot.action('teacher_register', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('teacher_register_start_scene');
});

bot.action('teacher_login', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.scene.enter('teacher_login_scene');
});

bot.action('cancel_operation', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.reply('Operation cancelled.', Markup.removeKeyboard());
});

bot.hears('👨‍🏫 Teacher Registration', async (ctx) => {
    ctx.scene.enter('teacher_register_start_scene');
});

bot.hears('🔐 Teacher Login', async (ctx) => {
    ctx.scene.enter('teacher_login_scene');
});

bot.hears('📚 My Class', requireTeacherAuth, async (ctx) => {
  ctx.reply('📚 My Class Menu\nChoose an option:', myClassMenu);
});
bot.hears('⬅️ Back to Main Menu', requireTeacherAuth, async (ctx) => {
  ctx.reply('⬅️ Back to Teacher Menu.', teacherMenu);
});

bot.hears('📋 Request Class', requireTeacherAuth, async (ctx) => {
  const user = await getUserById(ctx.from.id); // Retrieve user info to check role
  if (user && user.role === 'teacher') {
    if (ctx.scene && ctx.scene.session) {
      await ctx.scene.leave(); // Reset previous scene state if any
    }
    await ctx.scene.enter('request_students_list_scene'); // Enter the scene
  } else {
    await ctx.reply('🛑 You are not authorized to use this feature.');
  }
});

bot.hears('🚪 Logout', async (ctx) => {
    ctx.session = null;
    ctx.reply('✅ Successfully logged out. Please log in again to access teacher features.', postLogoutMenu);
});
bot.hears('ℹ️ Help', (ctx) => {
    ctx.reply(
        '🤖 School System Bot Help\n\n' +
        '• Register as Teacher: Start the teacher registration process\n' +
        '• Teacher Login: Log in to your teacher account\n' +
        '• Contact Admin: Get assistance from administrators\n\n' +
        'For technical issues, please contact the system administrator.'
    );
});

bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('🛑 An error occurred. Please try again.');
});
bot.command('admin', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        return ctx.reply('⚙️ Admin Panel', adminMenu);
    }
    ctx.scene.enter('admin_login_scene');
});


// --- Text/Keyboard Handlers ---


bot.hears('👨‍👩‍👧 My Children', async (ctx) => {
    try {
        
        const user = await User.findOne({ telegramId: ctx.from.id });
        
        if (!user) {
            return ctx.reply('🛑 You are not registered in the system. Please contact an administrator.');
        }

        const students = await Student.find({ parentId: ctx.from.id.toString() });
        
        if (user.role !== 'parent' && students.length === 0) {
            return ctx.reply(
                'INFO: No students linked to your account.\n\n' +
                'To link your child:\n' +
                '1. Use "🔗 Link Student" option\n' +
                '2. Enter your child\'s Student ID\n' +
                '3. Wait for admin approval'
            );
        }

        if (students.length > 0 && user.role !== 'parent') {
            await User.updateOne(
                { telegramId: ctx.from.id },
                { $set: { role: 'parent' } }
            );
            user.role = 'parent'; 
        }

        let message = `👨‍👩‍👧 Parent Profile\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `👤 Name: ${user.name}\n`;
        if (ctx.from.username) {
            message += `📱 Username: @${ctx.from.username}\n`;
        }
        message += `🆔 Telegram ID: ${ctx.from.id}\n`;
        message += `🎭 Role: ${user.role}\n\n`;

        if (students.length === 0) {
            message += `👶 No students registered under this parent.\n\n`;
            message += `To link a student, use the "🔗 Link Student" option.`;
        } else {
            message += `👨‍🎓 Students Registered:\n`;
            students.forEach((student, i) => {
                message += `\n${i + 1}. ${student.name}\n`;
                message += `   🆔 ID: <code>${student.studentId}</code>\n`;
                message += `   🏫 Class: ${student.class}\n`;
            });
        }

        ctx.replyWithHTML(message);

    } catch (err) {
        console.error('Error showing parent profile:', err);
        ctx.reply('🛑 Failed to load profile. Please try again later.');
    }
});
bot.hears('👨‍👩‍👧 ልጆቼ', async (ctx) => {
    try {
        const parent = await User.findOne({ telegramId: String(ctx.from.id), role: 'parentAm' });
        

        const students = await Student.find({ parentId: parent.telegramId });

        let message = `👨‍👩‍👧 የወላጅ መረጃ\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `👤 ስም፦ ${parent.name}\n`;
        if (ctx.from.username) {
            message += `📱 የቴሌግራም ስም፦ @${ctx.from.username}\n`;
        }
        message += `🆔 ቴሌግራም ID፦ ${ctx.from.id}\n`;
        message += `🎭 ሚና፦ ወላጅ\n\n`;

        if (students.length === 0) {
            message += `👶 ልጆች አልተመዘገቡም።`;
        } else {
            message += `👨‍🎓 የተመዘገቡ ልጆች፦\n`;
            students.forEach((student, i) => {
                message += `\n${i + 1}. ${student.name}\n`;
                message += `   🆔 መታወቂያ፦ ${student.studentId}\n`;
                message += `   🏫 ክፍል፦ ${student.class}\n`;
            });
        }

        ctx.replyWithHTML(message);

    } catch (err) {
        console.error('Error showing parent profile (Amharic):', err);
        ctx.reply('🛑 ፕሮፋይል መጫን አልተቻለም። እባክዎ እንደገና ይሞክሩ።');
    }
});



bot.hears('❓ Help/Contact School', async (ctx) => {
    try {
        
        const helpMessage = `
📖 Parent Help Menu

👨‍👩‍👧 As a parent, you can use this bot to:
• Link your children to your account
• View their grades and progress
• Track daily attendance
• Receive important announcements

🏫 School Contact Information:
📍 Address: Addis Ababa, Ethiopia  
☎️ Phone: +251-11-123-4567  
📧 Email: info@yourschool.edu

            Powered by Identity © 2025.

If you face any issues, please reach out to the school administration.
        `;

        ctx.replyWithMarkdown(helpMessage, parentMenu);
    } catch (error) {
        console.error('Error showing parent help menu:', error);
        ctx.reply('🛑 An error occurred while opening the help menu.');
    }
});


bot.hears('❓ Forgot Password', (ctx) => {
  ctx.scene.enter('teacher_forgot_password_scene');
});
bot.hears('🔓 Logout', async (ctx) => {
  try {
    await Teacher.updateOne(
      { telegramId: ctx.from.id },
      { $unset: { telegramId: "" } }
    );

    await User.updateOne(
      { adminId: ctx.from.id },
      { $unset: { adminId: "" } }
    );

    await ctx.reply('✅ You have been logged out.', postLogoutMenu);
  } catch (err) {
    console.error("Logout error:", err);
    await ctx.reply("Something went wrong during logout.");
  }
});
bot.hears('🔐 Login', async (ctx) => {
  ctx.scene.enter('teacher_login_scene'); 
});



bot.hears('🛡 Contact Admin', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_contact_admin_scene');
    } else {
        ctx.reply('🛑 You are not authorized to contact admins.');
    }
});
bot.hears('📤 Export Grades', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_export_grades_scene');
    } else {
        ctx.reply('🛑 You are not authorized to export grades.');
    }
});
bot.hears('🔍 Search Students', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_search_student_scene');
    } else {
        ctx.reply('🛑 You are not authorized to search students.');
    }
});
bot.hears('💬 Contact a Parent', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_contact_parent_scene');
    } else {
        ctx.reply('🛑 You are not authorized to contact parents.');
    }
});
bot.hears('🗑️ Remove Student', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_remove_student_scene');
    } else {
        ctx.reply('🛑 You are not authorized to remove students.');
    }
});
bot.hears('📢 Announce Parents', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('announce_class_scene');
    } else {
        ctx.reply('🛑 You are not authorized to send announcements.');
    }
});
bot.hears('📖 My Subjects', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_my_subjects_scene');
    } else {
        ctx.reply('🛑 You are not authorized to manage subjects.');
    }
});
bot.hears('📊 Manage Grades', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('manage_grades_scene');
    } else {
        ctx.reply('🛑 You are not authorized to manage grades.');
    }
});
bot.hears('🛡 Contact Admins', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('contact_admins_scene');
    } else {
        ctx.reply('🛑 You are not authorized to contact admins.');
    }
});
bot.hears('📞 Contact Parent', async (ctx) => {
  const user = await getUserById(ctx.from.id);
  if (user && user.role === 'admin') {
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('contact_parent_admin_scene');
  } else {
    ctx.reply('🛑 You are not authorized to contact parents.');
  }
});
bot.hears('✉️ Contact Teacher', async (ctx) => {
  const user = await getUserById(ctx.from.id);
  if (user && user.role === 'admin') {
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('contact_teacher_scene');
  } else {
    ctx.reply('🛑 You are not authorized to contact teachers.');
  }
});

bot.hears('🗑️ Remove Teacher', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('remove_teacher_scene');
    } else {
        ctx.reply('🛑 You are not authorized to remove teachers.');
    }
});

bot.hears('📋 View All Classes', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        const availableClasses = await getUniqueClasses();
        
        if (availableClasses.length === 0) {
            ctx.reply('No classes found. Please upload a student list first.');
            return;
        }
        
        const classList = availableClasses.map((className, index) => 
            `${index + 1}. ${className}`
        ).join('\n');
        
        ctx.reply(`📚 Available Classes:\n\n${classList}`);
    }
});
bot.hears('🎓 Students', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        ctx.reply('🧑‍🎓 Student Management:', studentManagementMenu);
    }
});

bot.hears('👥 Users', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        ctx.reply('👥 User Management:', userManagementMenu);
    }
});

bot.hears('📢 Announcements', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        ctx.scene.enter('announcement_recipient_scene');
    } else {
        ctx.reply('🛑 You do not have permission to send announcements.');
    }
});

bot.hears('🔍 Search Database', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && (user.role === 'admin')) {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('admin_search_scene');
    } else {
        ctx.reply('🛑 You are not authorized to use this feature.');
    }
});

bot.hears('📁 Manage Uploads', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        try {
            const uploadedFiles = await UploadedFile.find();

            if (uploadedFiles.length === 0) {
                await ctx.reply('📂 No files have been uploaded yet.');

                await logAdminAction(ctx, 'MANAGE_UPLOADS_VIEW', {
                    fileCount: 0
                });
                await notifyMasterAdmin(ctx, 'MANAGE_UPLOADS_VIEW', {
                    fileCount: 0
                });

                return;
            }

            let fileList = '<b>📂 Uploaded Files</b>:\n\n';
            uploadedFiles.forEach(file => {
                const status = file.processed ? '✅ Processed' : '⏳ Pending';
                const classInfo = file.classAssigned ? ` (Class: ${file.classAssigned})` : '';
                fileList += `• <b>${file.originalName}</b>\n`;
                fileList += `   🆔 ID: ${file.id}\n`;
                fileList += `   📅 Upload Date: ${new Date(file.uploadDate).toLocaleString()}\n`;
                fileList += `   📊 Status: ${status}${classInfo}\n\n`;
            });

            const deleteButtons = uploadedFiles.map(file =>
                [Markup.button.callback(`🗑️ Delete ${file.originalName}`, `delete_file_${file.id}`)]
            );

            await ctx.replyWithHTML(fileList, Markup.inlineKeyboard(deleteButtons));

            await logAdminAction(ctx, 'MANAGE_UPLOADS_VIEW', {
                fileCount: uploadedFiles.length
            });
            await notifyMasterAdmin(ctx, 'MANAGE_UPLOADS_VIEW', {
                fileCount: uploadedFiles.length
            });

        } catch (error) {
            console.error('Error managing uploads:', error);
            ctx.reply('🛑 An error occurred while retrieving uploaded files.');

            await logAdminAction(ctx, 'MANAGE_UPLOADS_ERROR', { error: error.message });
            await notifyMasterAdmin(ctx, 'MANAGE_UPLOADS_ERROR', { error: error.message });
        }
    } else {
        await ctx.reply('🛑 You are not authorized to manage uploads.');

        await logAdminAction(ctx, 'MANAGE_UPLOADS_UNAUTHORIZED', {
            attemptedBy: ctx.from.id
        });
        await notifyMasterAdmin(ctx, 'MANAGE_UPLOADS_UNAUTHORIZED', {
            attemptedBy: ctx.from.id
        });
    }
});


bot.hears('✏️ Edit Teacher', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('edit_teacher_scene');
    }
});


bot.hears('📋View Admins', async (ctx) => {
    try {
        const admins = await getAdmins();

        if (admins.length > 0) {
            const adminList = admins
                .map((u, i) => 
                    `<b>${i + 1}.</b> 👤 <b>${u.name}</b>\n🆔 <code>${u.telegramId}</code>\n🆎 Admin ID: ${u.adminId || 'N/A'}`
                )
                .join('\n\n');

            await ctx.replyWithHTML(
                `📋 <b>Current Admins</b>\n\n${adminList}`,
                
            );
        } else {
            await ctx.reply('⚠️ No admins found.');
        }
    } catch (error) {
        console.error('Error viewing admins:', error);
        await ctx.reply('🛑 An error occurred while retrieving admins.');
    }
});


bot.hears('📋 View Teachers', async (ctx) => {
  try {
    const teachers = await Teacher.find();
    if (teachers.length === 0) {
      return ctx.reply('No teachers found.');
    }

    let message = 'All Teachers:\n\n';
    teachers.forEach(t => {
      const subjects = t.subjects.length > 0 ? t.subjects.join(', ') : 'N/A';
      const telegramId = t.telegramId || 'N/A';
      message += `• ID: <code>${t.teacherId}</code>\n  Name: ${t.name}\n  Subjects: ${subjects}\n  Telegram ID: ${telegramId}\n\n`;
    });

    ctx.replyWithHTML(message);
  } catch (error) {
    console.error('Error viewing teachers:', error);
    ctx.reply('🛑 An error occurred while retrieving teachers.');
  }
});


bot.hears('📋 View Parents', async (ctx) => {
  try {
    const parents = await User.find({ role: { $in: ['parent', 'parentAm'] } });

    if (parents.length === 0) {
      return ctx.reply('🛑 No parents found.');
    }

    let content = `Parents List - Total: ${parents.length}\n\n`;
    content += 'Telegram ID | Name | Linked Students\n';
    content += '-----------------------------------------------------------\n';

    for (const p of parents) {
      let linkedStudents = [];

      if (p.studentIds && p.studentIds.length > 0) {
        const students = await Student.find({ studentId: { $in: p.studentIds } });
        linkedStudents = students.map(s => `${s.name} (${s.studentId})`);
      }

      const studentsText = linkedStudents.length > 0
        ? linkedStudents.join(', ')
        : 'None';

      content += `${p.telegramId} | ${p.name} | ${studentsText}\n`;
    }

    const fs = require('fs');
    const path = require('path');
    const tempDir = './temp_exports';
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `parents_list_${Date.now()}.txt`);
    fs.writeFileSync(filePath, content);

    await ctx.replyWithDocument(
      { source: filePath, filename: 'parents_list.txt' },
      { caption: `📋 Detailed list of parents (${parents.length} total)` }
    );

    fs.unlinkSync(filePath);

  } catch (error) {
    console.error('Error viewing parents:', error);
    ctx.reply('🛑 An error occurred while retrieving parents.');
  }
});


bot.hears('⛓️‍💥 Unlink Parent', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('unbind_parent_scene');
    }
});

bot.hears('➕ Add Student', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('add_student_scene');
    }
});

bot.hears('➖ Remove Student', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('remove_student_scene');
    }
});

bot.hears('✏️ Edit Student', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('edit_student_scene');
    }
});

bot.hears('📤 Upload Student List', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('upload_student_list_scene');
    }
});

bot.hears('📋 View All Students', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'admin') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('view_students_by_grade_scene');
    } else {
        ctx.reply('🛑 You are not authorized to use this feature.');
    }
});
bot.hears('⬅️ Back to Admin Menu', (ctx) => {
    ctx.reply('⬅️ Returning to admin menu.', adminMenu);
});


bot.hears('💯 View Grades', async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        
        const user = await User.findOne({ telegramId: userId });
        
        if (!user) {
            return ctx.reply('🚫 You are not registered in the system. Please use /start first.');
        }

        const students = await Student.find({ parentId: userId });
        
        if (students.length === 0) {
            return ctx.reply(
                'INFO: No students linked to your account.\n\n' +
                'To link your child:\n' +
                '1. Use "🔗 Link Student" option\n' +
                '2. Enter your child\'s Student ID\n' +
                '3. Wait for admin approval'
            );
        }

        if (user.role !== 'parent' && students.length > 0) {
            await User.updateOne(
                { telegramId: userId },
                { $set: { role: 'parent' } }
            );
        }

        if (ctx.scene?.current) {
            ctx.scene.leave();
        }

        if (students.length === 1) {
            return await displayStudentGrades(ctx, students[0]);
        }

        const buttons = students.map(student => 
            [Markup.button.callback(
                `📚 ${student.name} (${student.class || 'No Class'})`, 
                `view_grades_${student.studentId}`
            )]
        );
        
        const keyboard = Markup.inlineKeyboard(buttons);
        return ctx.reply('👨‍🎓 Select a student to view their grades:', keyboard);
        
    } catch (error) {
        console.error('Error in View Grades:', error);
        return ctx.reply('⚠️ An error occurred while retrieving grades. Please try again later.');
    }
});

bot.action(/view_grades_(.+)/, async (ctx) => {
    try {
        const studentId = ctx.match[1];
        const userId = ctx.from.id.toString();
        
        await ctx.answerCbQuery();
        
        const student = await Student.findOne({ 
            studentId: studentId, 
            parentId: userId 
        });
        
        if (!student) {
            return ctx.reply('🛑 Student not found or you are not authorized to view their grades.');
        }

        return await displayStudentGrades(ctx, student);
        
    } catch (error) {
        console.error('Error viewing grades:', error);
        await ctx.answerCbQuery();
        return ctx.reply('⚠️ An error occurred while retrieving grades. Please try again.');
    }
});




bot.hears('🔗 Link Another Student', async (ctx) => {
    const user = await getUserById(ctx.from.id.toString());
    
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('link_another_student_scene');
   
});


bot.hears('➕ Add a Student', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_add_student_scene');
    } else {
        ctx.reply('🛑 You are not authorized to add students.');
    }
});
bot.hears('📚 My Students', requireTeacherAuth, async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('teacher_my_students_scene');
    } else {
        ctx.reply('🛑 You are not authorized to manage students.');
    }
});

bot.hears('💬 Contact Parent', async (ctx) => {
    const user = await getUserById(ctx.from.id);
    if (user && user.role === 'teacher') {
        if (ctx.scene?.session) ctx.scene.leave();
        ctx.scene.enter('contact_parent_scene');
    } else {
        ctx.reply('🛑 You are not authorized to contact parents.');
    }
});


// --- Action Handlers ---  //


bot.action('teacher_forgot_password', async (ctx) => {
  await ctx.answerCbQuery();
  ctx.scene.enter('teacher_forgot_password_scene');
});

bot.action(/^resend_otp_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.match[1];
    
    const otpRecord = await OTP.findOne({ telegramId });
    if (!otpRecord) {
        ctx.reply('🛑 No pending registration found for this user.');
        return;
    }
    
    const newOTP = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    otpRecord.otp = newOTP;
    otpRecord.expiresAt = expiresAt;
    otpRecord.attempts = 0;
    otpRecord.verified = false;
    await otpRecord.save();
    
    ctx.reply(
        `🔐 New OTP generated for user ${telegramId}:\n\n` +
        `OTP: ${newOTP}\n` +
        `Expires: ${expiresAt.toLocaleTimeString()}`
    );
    
    try {
        await ctx.editMessageText(
            ctx.update.callback_query.message.text + `\n\n🔄 OTP Resent: ${newOTP}`,
            { parse_mode: "HTML" }
        );
    } catch (error) {
        console.error('Error editing message:', error);
    }
});

bot.action(/^cancel_registration_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const telegramId = ctx.match[1];
    
    await OTP.deleteOne({ telegramId });
    ctx.reply(`✅ Registration cancelled for user ${telegramId}.`);
    
    try {
        await ctx.editMessageText(
            ctx.update.callback_query.message.text + '\n\n🛑 Registration Cancelled',
            { parse_mode: "HTML" }
        );
    } catch (error) {
        console.error('Error editing message:', error);
    }
});

bot.action('teacher_my_subjects', async (ctx) => {
    await ctx.answerCbQuery(); 
    try {
        if (ctx.scene?.session) ctx.scene.leave();

        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });

        if (!teacher) {
            return ctx.reply('🛑 Teacher record not found. Please contact an admin.');
        }

        await ctx.scene.enter('teacher_my_subjects_scene');

    } catch (error) {
        console.error('Error handling teacher_my_subjects action:', error);
        await ctx.reply('🛑 An error occurred. Please try again.');
    }
});


bot.action('register_parent', async (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('register_parent_scene');
});

bot.action(/^announce_subject_(.+)$/, (ctx) => {
    const subject = ctx.match[1].replace(/_/g, ' ');
    ctx.session.announcementSubject = subject;
    ctx.answerCbQuery();
    ctx.reply(`📢 Please type the announcement to send to the parents of your students in ${subject}.`);
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('teacher_announcement_scene');
});

bot.action(/^manage_grades_(\d+)$/, (ctx) => {
    const studentId = ctx.match[1];
    ctx.session.currentStudentId = studentId;
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('manage_grades_scene');
});

bot.action('view_linked_children', async (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    try {
        const parent = await User.findOne({ telegramId: ctx.from.id, role: 'parent' });
        if (parent) {
            const studentIds = parent.studentIds || [];
            if (studentIds.length === 0) {
                return ctx.reply('You are not linked to any students.');
            }
            const students = await Promise.all(studentIds.map(id => getStudentById(id)));
            const validStudents = students.filter(s => s);
            if (validStudents.length === 0) {
                return ctx.reply('You are not linked to any valid students.');
            }
            const studentList = validStudents.map(s => `• Name: ${s.name}, ID: ${s.studentId}, Class: ${s.class || 'N/A'}`).join('');
            ctx.replyWithHTML(`Linked Students:
${studentList}`);
        } else {
            ctx.reply('🛑 Your profile could not be found.');
        }
    } catch (error) {
        console.error('Error viewing linked children:', error);
        ctx.reply('🛑 An error occurred while retrieving your linked students.');
    }
});

bot.action('add_new_subject', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('add_subject_scene');
});

bot.action('remove_subject', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('remove_subject_scene');
});

bot.action('teacher_add_student', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('teacher_add_student_scene');
});

bot.action('teacher_remove_student', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('teacher_remove_student_scene');
});

bot.action('back_to_teacher', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.reply('⬅️ Returning to teacher menu.', teacherMenu);
});

bot.action('back_to_parent', (ctx) => {
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.reply('⬅️ Returning to parent menu.', parentMenu);
});

bot.action('edit_student_name', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_student_name_scene');
});

bot.action('edit_student_class', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_student_class_scene');
});

bot.action('edit_student_parent', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_student_parent_scene');
});
bot.action('edit_teacher_name', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_teacher_name_scene');
});

bot.action('edit_teacher_subjects', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_teacher_subjects_scene');
});
bot.action('edit_teacher_telegram', async (ctx) => {
    await ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
    ctx.scene.enter('edit_teacher_telegram_scene');
});

bot.action(/^remove_subject_(.+)$/, async (ctx) => {
    const subjectToRemove = ctx.match[1].replace(/_/g, ' ');
    try {
        const teacher = await Teacher.findOne({ telegramId: ctx.from.id });
        if (teacher) {
            teacher.subjects = teacher.subjects.filter(s => s !== subjectToRemove);
            await teacher.save();
            
            const user = await getUserById(teacher.telegramId);
            if (user) {
                user.subjects = user.subjects.filter(s => s !== subjectToRemove);
                await user.save();
            }
            ctx.reply(`✅ Subject "${subjectToRemove}" has been removed from your profile.`, teacherMenu);
        } else {
            ctx.reply('🛑 An error occurred. Subject not found.', teacherMenu);
        }
    } catch (error) {
        console.error('Error removing subject:', error);
        ctx.reply('🛑 An error occurred while removing the subject.', teacherMenu);
    }
    ctx.answerCbQuery();
    if (ctx.scene?.session) ctx.scene.leave();
});




// --- Parent Approval Actions ---
bot.action(/^approve_parent_(.+)_(.+)$/, async (ctx) => {
    try {
        const parentId = ctx.match[1];
        const studentId = ctx.match[2];
        const requestId = `${parentId}_${studentId}`;

        await ctx.answerCbQuery('Processing request...');

        const admin = await User.findOne({ telegramId: ctx.from.id, role: 'admin' });
        
        if (!admin) {
            console.error(`Admin not found for Telegram ID: ${ctx.from.id}`);
            await ctx.answerCbQuery('🛑 Admin not authorized');
            return;
        }

        const adminName = admin.name || ctx.from.first_name || 'Admin';

        const student = await Student.findOne({ studentId });
        if (!student) {
            await ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(() => {});
            return ctx.reply('🛑 Student not found in database. Request cancelled.');
        }

        if (student.parentId === parentId) {
            await ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(() => {});
            return ctx.reply(`⚠️ Parent (ID: ${parentId}) is already linked to student ${student.name}. Request already processed.`);
        }
        
        if (student.pendingParentId !== parentId) {
            await ctx.telegram.deleteMessage(ctx.from.id, ctx.callbackQuery.message.message_id).catch(() => {});
            return ctx.reply('🛑 Parent link request is no longer valid (stale or denied by another admin).');
        }


        student.parentId = parentId;
        student.pendingParentId = null;
        student.pendingParentAt = null;
        await student.save();

        let parentUser = await User.findOne({ telegramId: parentId });
        if (parentUser) {
            parentUser.role = 'parent';
            parentUser.studentIds = parentUser.studentIds || [];
            if (!parentUser.studentIds.includes(studentId)) {
                parentUser.studentIds.push(studentId);
            }
            parentUser.pendingStudentRequests = parentUser.pendingStudentRequests || [];
            parentUser.pendingStudentRequests = parentUser.pendingStudentRequests.filter(
                req => req.studentId !== studentId
            );
            await parentUser.save();
        } else {
            parentUser = new User({
                telegramId: parentId,
                role: 'parent',
                studentIds: [studentId],
                name: 'Unknown'
            });
            await parentUser.save();
        }

        await cleanAndNotifyAdminsForParent(ctx, requestId, student, parentUser, adminName);    

        
        await ctx.replyWithHTML(
            `✅ Parent link approved!\n\n` +
            `👤 Parent: ${parentUser.name || 'Unknown'} (ID: ${parentId})\n` +
            `🎓 Student: ${student.name} (${studentId})\n` +
            `✅ Approved by: <b>${adminName}</b>\n` +
            `⏰ ${new Date().toLocaleString()}`
        );


        try {
            await ctx.telegram.sendMessage(
                parentId,
                `✅ Your parent account has been approved!\n\n` +
                `🎓 Student: ${student.name} (${studentId})\n` +
                `🏫 Class: ${student.class || 'Not assigned'}\n\n` +
                `You can now access your child's information.`,
                parentMenu 
            );
        } catch (notifyError) {
            console.error(`Failed to notify parent ${parentId}:`, notifyError);
        }

        await logAdminAction(ctx, 'APPROVE_PARENT', {
            parentId,
            studentId,
            studentName: student.name,
            approvedBy: adminName
        });

    } catch (error) {
        console.error('Error approving parent:', error);
        await ctx.answerCbQuery('🛑 Error approving parent');
        
        await ctx.reply('🛑 An error occurred while approving the parent link. Please try again.');
    }
});

//deny parent request

bot.action(/^deny_parent_(\d+)_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery('Denying parent request...');

  const parentId = ctx.match[1];
  const studentId = ctx.match[2];
  const requestId = `${parentId}_${studentId}`;

  try {
    const parent = await getUserById(parentId);
    const student = await getStudentById(studentId);
    const admin = await getUserById(ctx.from.id);

    if (!parent || !student || !admin) {
      await ctx.editMessageText(
        '🛑 Request not found or already processed.',
        { reply_markup: { inline_keyboard: [] } }
      );
      return;
    }

    if (!student.pendingParentId || student.pendingParentId !== parentId) {
      await ctx.editMessageReplyMarkup();
      return ctx.reply('⚠️ This request has already been processed by another admin.');
    }

    parent.pendingStudentRequests = (parent.pendingStudentRequests || []).filter(
      (r) => r.studentId !== studentId
    );
    await parent.save();

    student.pendingParentId = null;
    student.pendingParentAt = null;
    await student.save();
    
    await clearOtherPendingParentRequests(ctx, parent, studentId, admin);

    try {
      await ctx.telegram.sendMessage(
        parentId,
        `🛑 Your request to link with student <b>${student.name}</b> (ID: <code>${studentId}</code>) was denied by an administrator.`,
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error(`Failed to notify parent ${parentId}:`, error);
    }

    const denialText =
      `🛑 <b>PARENT LINK DENIED</b>\n\n` +
      `👤 Parent: <b>${parent.name}</b> (ID: ${parent.telegramId})\n` +
      `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
      `🚫 Denied by: <b>${admin.name || ctx.from.first_name || 'Admin'}</b>\n` +
      `⏰ ${new Date().toLocaleString()}`;

    const approval = await ApprovalMessage.findOne({ type: 'parent', requestId });
    if (approval) {
      for (const msg of approval.messages) {
        try {
            await ctx.telegram.editMessageReplyMarkup(
                msg.adminId, 
                msg.messageId, 
                null, 
                { inline_keyboard: [] }
            );
            if (msg.adminId !== ctx.from.id) {
              await ctx.telegram.sendMessage(msg.adminId, denialText, { parse_mode: 'HTML' });
            }
        } catch (err) {
          console.error(`Failed to notify admin ${msg.adminId}:`, err.message);
        }
      }
      await ApprovalMessage.deleteOne({ _id: approval._id });
    }

    const master = await User.findOne({ role: 'masterAdmin' });
    if (master) {
      await ctx.telegram.sendMessage(master.telegramId, denialText, { parse_mode: 'HTML' });
    }

    await logAdminAction(ctx, 'DENY_PARENT', {
      parentId: parent.telegramId,
      parentName: parent.name,
      studentId: student.studentId,
      studentName: student.name,
      deniedBy: admin.telegramId,
      deniedByName: admin.name
    });

    await ctx.replyWithHTML(
      `🛑 You denied the parent link request.\n\n` +
      `👤 Parent: <b>${parent.name}</b>\n` +
      `🎓 Student: <b>${student.name}</b> (${student.studentId})\n\n` +
      `🕒 ${new Date().toLocaleString()}`
    );

  } catch (error) {
    console.error('Error denying parent:', error);
    await ctx.reply('🛑 An error occurred while denying the parent request.');
  }
});




const CONFIRM_TIMEOUT_MS = 60 * 1000; 

bot.action(/^delete_file_(.+)$/, async (ctx) => {
  const fileIdToDelete = ctx.match[1];
  await ctx.answerCbQuery();

  const user = await getUserById(ctx.from.id);
  if (!user || (user.role !== 'admin' && !user.masterAdmin)) {
    await logAdminAction(ctx, 'DELETE_FILE_UNAUTHORIZED', {
      fileId: fileIdToDelete,
      attemptedBy: ctx.from.id
    });

    await notifyMasterAdmin(ctx, 'DELETE_FILE_UNAUTHORIZED', {
      fileId: fileIdToDelete,
      attemptedBy: ctx.from.id
    });

    return ctx.reply('🛑 You are not authorized to delete files.');
  }

  ctx.session.pendingDeletes = ctx.session.pendingDeletes || {};

  ctx.session.pendingDeletes[ctx.from.id] = {
    fileId: fileIdToDelete,
    expiresAt: Date.now() + CONFIRM_TIMEOUT_MS
  };

  await logAdminAction(ctx, 'DELETE_FILE_REQUESTED', {
    fileId: fileIdToDelete,
    expiresIn: `${Math.floor(CONFIRM_TIMEOUT_MS / 1000)}s`
  });

  await notifyMasterAdmin(ctx, 'DELETE_FILE_REQUESTED', {
    fileId: fileIdToDelete,
    requestedBy: ctx.from.id,
    expiresIn: `${Math.floor(CONFIRM_TIMEOUT_MS / 1000)}s`
  });

  await ctx.reply(
    `⚠️ Are you sure you want to delete this file?\n\n` +
    `🆔 File ID: ${fileIdToDelete}\n\n` +
    `👉 Type CONFIRM within ${Math.floor(CONFIRM_TIMEOUT_MS/1000)} seconds to delete.\n` +
    `👉 Type anything else to cancel.`
  );
});

bot.on('text', async (ctx, next) => {
  const pendingMap = ctx.session.pendingDeletes;
  if (!pendingMap) return next();

  const pending = pendingMap[ctx.from.id];
  if (!pending) return next();

  delete pendingMap[ctx.from.id];

  if (Date.now() > pending.expiresAt) {
    await ctx.reply('⏰ Deletion timed out. Cancelled.');
    return;
  }

  const input = ctx.message.text.trim().toUpperCase();
  const fileId = pending.fileId;

  if (input === 'CONFIRM') {
    const user = await getUserById(ctx.from.id);
    if (!user || (user.role !== 'admin' && !user.masterAdmin)) {
      await ctx.reply('🛑 You are not authorized to perform this action.');
      return;
    }

    try {
      const result = await UploadedFile.deleteOne({ id: fileId });
      if (result.deletedCount > 0) {
        await ctx.reply('🗑️ File deleted successfully.');

        
      } else {
        await ctx.reply('🛑 File not found.');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      await ctx.reply('🛑 An error occurred while deleting the file.');
    }
  } else {
    await ctx.reply('🛑 Deletion cancelled.');
  }
});


const MASTER_ADMIN_ID = process.env.MASTER_ADMIN_ID; 

process.on('uncaughtException', async (error) => {
    console.error('🛑 Uncaught Exception:', error);
    const message = `🛑 <b>BOT CRASH (Uncaught Exception)</b> 🛑\n\n` +
                    `<b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}\n` +
                    `<b>Error:</b> ${error.message}\n` +
                    `<b>Stack:</b> \n<pre>${error.stack ? error.stack.substring(0, 1500) : 'No stack trace'}</pre>\n\n` +
                    `Attempting emergency exit (Code 1)...`;
    
    if (MASTER_ADMIN_ID && bot.telegram) {
        try {
            await bot.telegram.sendMessage(MASTER_ADMIN_ID, message, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Failed to send uncaughtException notification to admin:', e.message);
        }
    }
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
    const message = `⚠️ <b>BOT WARNING (Unhandled Rejection)</b> ⚠️\n\n` +
                    `<b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}\n` +
                    `<b>Reason:</b> ${reason.message || String(reason)}\n` +
                    `<b>Stack:</b> \n<pre>${reason.stack ? reason.stack.substring(0, 1500) : 'No stack trace'}</pre>\n\n` +
                    `The bot process is still running. Check logs immediately.`;
    
    if (MASTER_ADMIN_ID && bot.telegram) {
        try {
            await bot.telegram.sendMessage(MASTER_ADMIN_ID, message, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Failed to send unhandledRejection notification to admin:', e.message);
        }
    }
});

process.once('SIGINT', async () => {
    console.log('🤖 SIGINT received. Stopping bot...');
    const message = `🚧 <b>BOT SHUTDOWN (SIGINT)</b> 🚧\n\n` +
                    `<b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })}\n` +
                    `The bot is stopping gracefully (manual stop/ctrl+c).`;
    if (MASTER_ADMIN_ID && bot.telegram) {
        try {
            await bot.telegram.sendMessage(MASTER_ADMIN_ID, message, { parse_mode: 'HTML' });
        } catch (e) {
            console.error('Failed to send SIGINT notification:', e.message);
        }
    }
    bot.stop('SIGINT');
});

async function startBot() { 
    
    await connectWithRetry();

   
    try {
        await bot.launch();

        console.log('Bot started');

        process.once('SIGINT', () => bot.stop('SIGINT'));
        process.once('SIGTERM', () => bot.stop('SIGTERM'));

    } catch (err) {
        console.error('Failed to start bot:', err);
    }
}
const socketIoClient = require('socket.io-client');
const os = require('os');

const MONITOR_SERVER = process.env.MONITOR_SERVER || 'http://localhost:3000';
const INSTANCE_ID = process.env.INSTANCE_ID || 'bot-instance-1'; 
const DB_PATH = process.env.DB_NAME || 'data.db';
const AGENT_TOKEN = process.env.AGENT_TOKEN || 'your_agent_token'; 

const socket = socketIoClient(MONITOR_SERVER);

// Enhanced connection handling
socket.on('connect', () => {
    console.log(`Successfully connected to monitor server at ${MONITOR_SERVER}`);
    
    // 1. Authenticate immediately upon connection
    socket.emit('authenticate', AGENT_TOKEN);
    
    // 2. Register instance immediately after authentication is sent
    socket.emit('register', { 
        id: INSTANCE_ID, 
        dbPath: path.resolve(DB_PATH) 
    });
    
    console.log(`Bot instance ${INSTANCE_ID} registered with monitor`);
});

socket.on('disconnect', (reason) => {
    console.error(`Socket disconnected. Reason: ${reason}`);
});

socket.on('connect_error', (error) => {
    console.error(`Connection error: ${error.message}`);
});

// Start sending metrics
setInterval(() => {
    if (socket.connected) {
        const metrics = {
            cpu: (os.loadavg()[0] * 100) / os.cpus().length,
            ram: {
                used: process.memoryUsage().heapUsed / 1024 / 1024,
                total: os.totalmem() / 1024 / 1024,
                free: os.freemem() / 1024 / 1024
            },
            uptime: process.uptime(),
            systemUptime: os.uptime(),
            running: true // Always true since this code is running
        };
        socket.emit('metrics', metrics);
    }
}, 5000);

// Log interception
const originalConsoleLog = console.log;
console.log = function(...args) {
    if (socket.connected) {
        socket.emit('log', { level: 'info', message: args.join(' ') });
    }
    originalConsoleLog.apply(console, args);
};

const originalConsoleError = console.error;
console.error = function(...args) {
    if (socket.connected) {
        socket.emit('log', { level: 'error', message: args.join(' ') });
    }
    originalConsoleError.apply(console, args);
};

// Handle process termination
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (socket.connected) {
        socket.emit('log', { level: 'info', message: 'Bot instance shutting down gracefully' });
        socket.disconnect();
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down...');
    if (socket.connected) {
        socket.emit('log', { level: 'info', message: 'Bot instance shutting down' });
        socket.disconnect();
    }
    process.exit(0);
});

console.log('Bot monitoring agent started');
console.log(`Instance ID: ${INSTANCE_ID}`);
console.log(`Monitor Server: ${MONITOR_SERVER}`);

// Your bot's main application logic would continue here...
// For example:
setInterval(() => {
    console.log('Bot is running normally...');
}, 30000);


startBot();