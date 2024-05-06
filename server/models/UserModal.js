const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    name: {
        type : String, 
        required : true,
        // minlength: [3, 'Name should be at least 3 characters'],
        // maxlength: [10, 'Name should be at most 10 characters'],
        // unique: [true, 'username already exists']
    },
    email: {
        type:String,
        required:true,
        unique:[true,'Email already exists'],
    },
    password:{
        type:String,
        required:true,
        minlength: [6, 'Password should be at least 6 characters']
    },
    role : {
        type: String,
        default: 'patient'
    },
    avatar: {
        type: String,
        default: 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png'
    },
});

const UserModal = mongoose.model('users', UserSchema);
module.exports = UserModal;