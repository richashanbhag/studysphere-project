const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// --- Models ---
const Group = require('../models/Group');
const User = require('../models/User');
const JoinRequest = require('../models/JoinRequest');
const Message = require('../models/Message');
const File = require('../models/File');

// --- Multer Setup for File Uploads ---
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// @route   POST api/groups
// @desc    Create a new study group
// @access  Private
router.post('/', [auth, [
    check('name', 'Group name is required').not().isEmpty(),
    check('subject', 'Subject is required').not().isEmpty(),
    check('capacity', 'Capacity must be a number').isNumeric(),
]], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, subject, university, capacity, isPrivate } = req.body;

    try {
        const newGroup = new Group({
            name,
            subject,
            university,
            capacity,
            isPrivate: isPrivate || false,
            createdBy: req.user.id,
            members: [req.user.id] // Creator is the first member
        });

        const group = await newGroup.save();
        res.status(201).json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/groups
// @desc    Get all public groups user is not a member of
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const groups = await Group.find({
            isPrivate: false,
            members: { $ne: req.user.id } // $ne = not equal to
        }).populate('createdBy', 'fullName').sort({ createdAt: -1 });
        res.json(groups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/groups/my
// @desc    Get all groups the current user is a member of
// @access  Private
router.get('/my', auth, async (req, res) => {
    try {
        const groups = await Group.find({ members: req.user.id }).sort({ createdAt: -1 });
        res.json(groups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/groups/:id
// @desc    Get a single group's details by ID
// @access  Private (must be a member)
router.get('/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id).populate('createdBy', 'fullName').populate('members', 'fullName');
        if (!group) {
            return res.status(404).json({ msg: 'Group not found.' });
        }
        // Ensure the requesting user is a member of the group
        if (!group.members.some(member => member._id.equals(req.user.id))) {
            return res.status(403).json({ msg: 'Access denied. You are not a member of this group.' });
        }
        res.json(group);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   PUT api/groups/join/:id
// @desc    Join a public group or request to join a private group
// @access  Private
router.put('/join/:id', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ msg: 'Group not found.' });
        if (group.members.includes(req.user.id)) return res.status(400).json({ msg: 'You are already a member of this group.' });
        if (group.members.length >= group.capacity) return res.status(400).json({ msg: 'This group is already full.' });

        if (group.isPrivate) {
            // Private group: create a join request
            const existingRequest = await JoinRequest.findOne({ user: req.user.id, group: group.id, status: 'pending' });
            if (existingRequest) return res.status(400).json({ msg: 'You have already sent a join request to this group.' });

            const joinRequest = new JoinRequest({ user: req.user.id, group: group.id });
            await joinRequest.save();
            return res.json({ msg: 'Join request sent to the group creator for approval.' });

        } else {
            // Public group: join directly
            group.members.push(req.user.id);
            await group.save();
            return res.json({ msg: 'Successfully joined the group!', group });
        }
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/groups/:id/requests
// @desc    Get pending join requests for a group (creator only)
// @access  Private
router.get('/:id/requests', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group) return res.status(404).json({ msg: 'Group not found' });
        if (!group.createdBy.equals(req.user.id)) return res.status(403).json({ msg: 'You are not authorized to view these requests.' });

        const requests = await JoinRequest.find({ group: req.params.id, status: 'pending' }).populate('user', 'fullName');
        res.json(requests);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/groups/requests/:reqId/respond
// @desc    Respond to a join request (approve/reject)
// @access  Private
router.put('/requests/:reqId/respond', auth, async (req, res) => {
    const { action } = req.body; // 'approve' or 'reject'
    try {
        const request = await JoinRequest.findById(req.params.reqId).populate('group');
        if (!request) return res.status(404).json({ msg: 'Request not found.' });
        if (!request.group.createdBy.equals(req.user.id)) return res.status(403).json({ msg: 'Not authorized to respond to this request.' });

        if (action === 'approve') {
            const group = await Group.findById(request.group._id);
            if (group.members.length >= group.capacity) return res.status(400).json({ msg: 'Cannot approve, the group is full.' });
            
            group.members.push(request.user);
            await group.save();
            request.status = 'approved';
        } else {
            request.status = 'rejected';
        }
        await request.save();
        res.json({ msg: `Request has been ${request.status}.` });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


// @route   GET api/groups/:id/messages
// @desc    Get all messages for a group
// @access  Private (must be a member)
router.get('/:id/messages', auth, async (req, res) => {
    try {
        // Authorization check (can be expanded)
        const group = await Group.findById(req.params.id);
        if (!group || !group.members.includes(req.user.id)) return res.status(403).json({ msg: 'Access Denied.' });

        const messages = await Message.find({ group: req.params.id }).populate('user', 'fullName').sort({ timestamp: 1 });
        res.json(messages);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/groups/:id/files
// @desc    Get all files for a group
// @access  Private (must be a member)
router.get('/:id/files', auth, async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group || !group.members.includes(req.user.id)) return res.status(403).json({ msg: 'Access Denied.' });

        const files = await File.find({ group: req.params.id }).populate('user', 'fullName').sort({ uploadDate: -1 });
        res.json(files);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/groups/:id/upload
// @desc    Upload a file to a group
// @access  Private (must be a member)
router.post('/:id/upload', [auth, upload.single('file')], async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);
        if (!group || !group.members.includes(req.user.id)) return res.status(403).json({ msg: 'Access Denied.' });
        if (!req.file) return res.status(400).json({ msg: 'No file uploaded.' });

        const newFile = new File({
            group: req.params.id,
            user: req.user.id,
            originalName: req.file.originalname,
            filePath: req.file.filename,
            fileType: req.file.mimetype,
        });

        await newFile.save();
        // The file is broadcast to clients via Socket.IO in server.js,
        // but we return the success response here.
        res.status(201).json(newFile);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


module.exports = router;

