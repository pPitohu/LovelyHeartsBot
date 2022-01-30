const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    human_name: {
        type: String,
        required: true,
    },
    username: {
        type: String,
        required: true,
    },
    chatId: {
        type: String,
        required: true,
    },
    animation: {
        type: Object,
        required: false,
    },
    date: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('User', UserSchema);
