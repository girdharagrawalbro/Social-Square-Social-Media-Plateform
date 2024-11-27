const connectToMongo = require('./db.js');
const express = require('express')
var cors = require('cors')
connectToMongo();
const app = express()
const port = 5000

app.use(cors())
app.use(express.json())

// Available Routes
app.use('/api/auth', require('./routes/auth.js'));
app.use('/api/post', require('./routes/post.js'));

app.listen(port, () => {
  console.log(`Social Media Plateform backend listening at http://localhost:${port}`)
})