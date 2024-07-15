import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const storage = multer.diskStorage({
    destination: function (req, res, cb) {
        cb(null, './public/temp');
    },
    filename: function (req, file, cb) {
        const fileName = `${uuidv4()}.txt`
        cb(null, fileName);
    }
})

const upload = multer({
    storage: storage,
    limit: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

export default upload;