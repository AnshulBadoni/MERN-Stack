const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const { MongoClient, GridFSBucket } = require('mongodb');
const {GridFsStorage} = require('multer-gridfs-storage');
const cors = require('cors');
// const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');

const app = express();
const port = 5000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(cors());

app.use(session({
  secret: "mern stack project",
  resave: false,
  saveUninitialized: false,
}))

app.use(passport.initialize());
app.use(passport.session());
  
mongoose.connect('mongodb://localhost:27017/characters', { useNewUrlParser: true });

let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
  const db = conn.db;
  gfs = new GridFSBucket(db, { bucketName: 'uploads' });
});


// Create storage engine
const storage = new GridFsStorage({
  url: 'mongodb://localhost:27017/characters',
  file: (req, file) => {
    return {
      bucketName: 'uploads',
      filename: file.originalname
    };
  }
});

// Create multer middleware with storage
const upload = multer({ storage });

// for login and register
const userschema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
});

userschema.plugin(passportLocalMongoose);

const User = mongoose.model('User', userschema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const charactersSchema = {
  name: String,
  description: String,
  image: String,
};

const Character = mongoose.model('Character', charactersSchema);


////////////////login routes///////////////////////////////


app.get('/login', function (req, res) {
  res.sendFile(__dirname + '/public/login.html');
});
app.get('/register', function (req, res) {
  res.sendFile(__dirname + '/public/register.html');
});
app.get('/',function(req,res){
  if(req.isAuthenticated()){
    res.sendFile(__dirname + '/public/admin.html');
  }
  else{
    res.redirect('/login');
  }
});
app.post('/register', function (req, res) {
  User.register({username:req.body.username},req.body.password,function(err,user){
    if(err){
      console.log("error",err);
      res.redirect('/register');
    }
    else{
      passport.authenticate('local')(req,res,function(){
        res.redirect('/login');
      })
    }
  })
});

app.post('/login', function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user,function(err){
    if(err){
      res.redirect('/login');
      console.log(err);
    }
    else{
      passport.authenticate('local')(req,res,function(){
        res.redirect('/');
      })
    }
  })
});
app.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
    }
    req.logout(function() {}); // Use an empty callback function
    res.redirect('/login');
  });
});


/////////////////////login routes ended//////////////////////////////////////



app.route('/characters')
  .get((req, res) => {
    const perPage = 10; // Number of results per page
    const page = parseInt(req.query.page) || 1; // Current page number, default is 1
    Character.find()
      .skip((page - 1) * perPage)
      .limit(perPage)
      .then((foundCharacters) => {
        res.send(foundCharacters);
      })
      .catch((err) => {
        res.send(err);
      });
  })
  .post(upload.single('file'), (req, res) => {
    const name = req.body.name;
    const description = req.body.description;
    const imageFile = req.file;

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${imageFile.filename}`;

    const newCharacter = new Character({
      name: name,
      description: description,
      image: imageUrl,
    });

    newCharacter
      .save()
      .then(() => {
        // res.send('Successfully added character');
        res.sendFile(__dirname + '/public/admin.html');

      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  })
  .delete((req, res) => {
    Character.deleteMany()
      .then(() => {
        res.send('All characters are deleted');
      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  });

app.route('/characters/:id')
  .get((req, res) => {
    const characterId = req.params.id;
    Character.findById(characterId)
      .then((foundCharacter) => {
        if (foundCharacter) {
          res.send(foundCharacter);
        } else {
          res.send('Character not found');
        }
      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  })
  .put((req, res) => {
    const characterId = req.params.id;
    const updatedCharacter = {
      name: req.body.name,
      description: req.body.description,
    };
    Character.findByIdAndUpdate(characterId, updatedCharacter, { new: true })
      .then((updatedCharacter) => {
        if (updatedCharacter) {
          res.send('Updated successfully');
        } else {
          res.send('Character not found');
        }
      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  })
  .patch((req, res) => {
    const characterId = req.params.id;
    const updatedCharacter = { ...req.body };
    
    if (req.file) {
      // If a new image file is provided, set the "image" field to the file path or URL
      updatedCharacter.image = req.file.path; // Update this based on your file storage configuration
    } else {
      // Remove the "image" field if no new image is being sent
      delete updatedCharacter.image;
    }
    
    Character.findByIdAndUpdate(characterId, { $set: updatedCharacter }, { new: true })
      .then((updatedCharacter) => {
        if (updatedCharacter) {
          res.send('Updated successfully');
        } else {
          res.send('Character not found');
        }
      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  })
  
  
  .delete((req, res) => {
    const characterId = req.params.id;
    Character.findByIdAndDelete(characterId)
      .then(() => {
        res.send('Character is deleted');
      })
      .catch((err) => {
        res.send('Error happened: ' + err);
      });
  });

// Route for accessing uploaded images
app.get('/uploads/:filename', (req, res) => {
  if (!gfs) {
    return res.status(500).json({
      message: 'GridFS stream is not initialized',
    });
  }

  const filename = req.params.filename;

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads',
  });

  const downloadStream = bucket.openDownloadStreamByName(filename);

  downloadStream.on('error', (err) => {
    return res.status(500).json({
      message: 'Error occurred while retrieving the image',
      error: err,
    });
  });

  downloadStream.on('data', (chunk) => {
    res.write(chunk);
  });

  downloadStream.on('end', () => {
    res.end();
  });
});
// route for search query
app.get('/characters/search', (req, res) => {
    const searchQuery = req.query.query;
    console.log('Received search query:', searchQuery);
  
    Character.find({ name: { $regex: searchQuery, $options: 'i' } })
      .then((foundCharacters) => {
        res.send(foundCharacters);
      })
      .catch((err) => {
        res.status(500).send('Error happened: ' + err);
      });
  });
  // get all user for admin without page limit
  app.route('/allcharacters')
  .get((req, res) => {
    Character.find()
      .then((foundCharacters) => {
        res.send(foundCharacters);
      })
      .catch((err) => {
        res.send(err);
      });
  })
// api uptime 
app.get('/api/uptime', (req, res) => {
  const uptime = process.uptime(); // Get the current server uptime in seconds
  res.json({ uptime });
});

  
  
  
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
