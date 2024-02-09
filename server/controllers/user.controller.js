import { User } from '../models/user.model.js';

const registerUser = async (req, res)=>{
    const {username, email, password} = req.body;
    //! Checking if the data entered is valid or not.
    if([username, email, password].some(
        (field)=> field?.trim() === ""
    )){
        throw new Error(400, "Proper Data is Required");
    }

    const existedUser = await User.findOne({
        $or: [{username, email}],
    });
    if(existedUser){
        throw new Error(409, "User with username or email already exists");
    }

    const user = await User.create({
        username: username.toLowerCase(),
        email,
        password //! Password will be hashed automatically with method defined in model.
    });

    return res.status(201).json({message: 'User created Successfully'});
}

const loginUser = async (req, res)=>{
    const {username, password} = req.body;
    if(!username){
        throw new Error('Username is required');
    }
    const user = await User.findOne({username});
    if(!user){
        throw new Error('User does not exists');
    }
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new Error('User password is incorrect');
    }
    const options = {
        httpOnly: true,
        secure: true
    }
    res.status(200).cookie("username", username, options).json({message: "User Logged in Successfully"});
}

// const logoutUser = async(req, res)=>{
//     await User.findByIdAndUpdate(req.user._id,{
//         $unset: {

//         }
//     })
// }

// const changeCurrentPassword = async(req, res)=>{
    
// }

export {registerUser, loginUser};