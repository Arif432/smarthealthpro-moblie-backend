const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const userRoutes = require('./routes/userRoutes'); // Assuming correct path
const productRoutes = require("./routes/productsRoutes"); 
const cartRoutes = require("./routes/CartRoute");
const orderRoutes = require("./routes/OrderRoute");
const genreRoutes = require('./routes/GenresRoutes')
const authorRoutes = require('./routes/AuthorsRoute')

require('dotenv').config();
const app = express();
app.use(express.json());

app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: "http://localhost:5000"
}));

const mongodbURI = "mongodb+srv://MuhammadArifNawaz:03006340067@task-manager-2nd.mesyzb7.mongodb.net/doctorsHealthSystem";
const PORT = process.env.PORT || 5000;

mongoose.connect(mongodbURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
        console.log('MongoDB connected successfully');
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error);
    });
app.use('/user', userRoutes);
app.use('/product', productRoutes);
app.use('/cart', cartRoutes);
app.use('/order', orderRoutes);
app.use('/genres',genreRoutes)
app.use('/authors',authorRoutes)

app.listen(PORT, () => {
    console.log('Server started at port:', PORT);
});
