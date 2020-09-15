const express = require('express');
const app = express();
const multer = require('multer');
const Queue = require('bull');
const imageQueue = new Queue('Adding Image Watermark', { redis: { port: 6379, host: '127.0.0.1' } });
const path = require('path');
const Jimp = require('jimp');
const fs = require('fs');
const LOGO_SIZE = 40;
const OFFSET = 10;


app.use(express.static(__dirname + '/public'));

imageQueue.process(async function (job, done) {
    // console.log(job.data);
    const text = '@watermark';
    const img = await Jimp.read(job.data.path).catch(err => console.log(err));
    const logo = await Jimp.read('public/smiley.png').catch(err => console.log(err));
    const font = await Jimp.loadFont('public/roboto_medium.fnt');
    const h = img.getHeight();
    const w = img.getWidth();
    const tw = Jimp.measureText(font, text);
    const th = Jimp.measureTextHeight(font, text, tw + 2);
    // Bottom right
    // try {
    const type = 0;
    if (type == 0) {
        // Bottom Right
        img.print(font, w - tw - OFFSET, h - th - OFFSET, text);
        img.composite(logo.resize(LOGO_SIZE, LOGO_SIZE), w - tw - LOGO_SIZE - 20, h - LOGO_SIZE - OFFSET, {
            mode: Jimp.BLEND_SOURCE_OVER,
            opacitySource: 1,
            opacityDest: 1
        });
    }
    img.write('public/' + job.data.filename);
    // } catch (e) {
    //     console.log(e);
    // }
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('done');
    fs.unlinkSync(job.data.path); // Remove Tempoarary File
    done(null, { filename: job.data.filename });
});

app.post('/upload', (req, res) => {
    console.log(req.query);
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
        imageQueue.add({ path: req.file.path, filename: req.file.filename }).then(data => res.json(data.id));
    });
});

app.get('/status', (req, res) => {
    let { id } = req.query;
    id = parseInt(id);
    if (isNaN(id)) {
        res.status(422).send('Invalid ID');
        return;
    }
    imageQueue.getJob(id).then(job => job.getState().then(state => res.json({ state, data: job.returnvalue })));
});

app.listen(3000, () => console.log('Started at http://localhost:3000'));