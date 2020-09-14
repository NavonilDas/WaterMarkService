const express = require('express');
const app = express();
const multer = require('multer');
const Queue = require('bee-queue');
const imageQueue = new Queue('Adding Image Watermark', { redis: { port: 6379, host: '127.0.0.1' } });
const path = require('path');
const Jimp = require('jimp');
const COMPLETED = {};
const FAILED = {};

app.use(express.static(__dirname + '/public'));

async function Sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

imageQueue.process(async function (job, done) {
    job.status = 'hello';
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('done');
    return { img: 'ddd' };
});

imageQueue.on('succeeded', (job, result) => {
    COMPLETED[job.id] = result;
});

imageQueue.on('failed', (job, result) => {
    FAILED[job.id] = result;
});

app.post('/upload', (req, res) => {
    let upload = multer({
        storage: multer.diskStorage({
            destination: function (req, file, cb) {
                cb(null, 'uploads/');
            },
            filename: function (req, file, cb) {
                cb(null, Date.now().toString() + path.extname(file.originalname));
            },
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
                    cb(null, true)
                } else {
                    cb(new Error('Invalid Mime Type, only JPEG and PNG'), false);
                }
            }
        })
    }).single('image');

    upload(req, res, function (err) {
        if (req.fileValidationError) {
            return res.status(422).send({ errors: [{ title: 'Please select an image to upload', detail: req.fileValidationError }] })
        }
        else if (!req.file) {
            return res.status(422).send({ errors: [{ title: 'Please select an image to upload', detail: '' }] })
        }
        else if (err instanceof multer.MulterError) {
            return res.status(422).send({ errors: [{ title: 'Failed to same Image (MulterError)', detail: err.message }] })
        }
        else if (err) {
            return res.status(422).send({ errors: [{ title: 'Failed to Save Image', detail: err.message }] })
        }
        // TODO Add to QUEUE
        const job = imageQueue.createJob({ a: 'jfjfjfjf' });
        job.retries(2);
        job.save().then(data => res.json({ id: data.id }));
    });
    // res.json({});
});

app.get('/status', (req, res) => {
    let { id } = req.query;
    id = parseInt(id);
    if (isNaN(id)) {
        res.status(422).send('Invalid ID');
        return;
    }
    imageQueue.getJob(id, function (err, job) {
        res.json({ status: job.status });
        console.log(job.data);
        job.on
        console.log(`Job ${id} has status ${job.status}`);
    });
});

app.listen(3000, () => console.log('Started at http://localhost:3000'));