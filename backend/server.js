require('dotenv').config();
const helmet = require('helmet');
const multer = require('multer');
const express = require('express');
const rateLimit = require('express-rate-limit');
const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 5011;
const bodyParser = require('body-parser');
const cors = require('cors');
const getDataController = require('./Controllers/GetFuncData');
const PostDataController = require('./Controllers/PostFuncData');
const ExcelController = require('./Controllers/ExcelController');
const progressManager = require('./Controllers/Progress');
//multer
const upload = multer({ dest: 'uploads/' });
const jwt = require('jsonwebtoken');
const secretkey = process.env.JWT_SECRET;
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (req.path === '/loginUsers') {
    // Si es la ruta de generación del token, continuar sin verificar el token
    next();
  } else {
    // Verificar el token en todas las demás rutas
    if (token == null) return res.sendStatus(401);

    jwt.verify(token, secretkey, (err, user) => {
      if (err) return res.status(403).send();
      req.user = user;
      next();
    });
  }
}

//limitador de tasa contra ddos
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limita cada ip a 100 request
});

//limitador de tasa a todas las rutas
app.use(limiter);

const allowedOrigins = [
  'http://localhost:3000',
  'https://carga-afiliados.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // permite requests sin origen (como mobile apps o curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'El origen CORS no está permitido.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json());

// Rate limiter específico para barra de progreso
const progressLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // Permite 300 requests en 15 minutos 
});

app.get('/upload-progress',progressLimiter, (req, res) => {
  res.json(progressManager.getProgress());
});

app.post('/loginUsers', authenticateToken, PostDataController.loginUsers__); // Login para obtener el token
app.get('/getUserList', authenticateToken, getDataController.listUsers__); // Lista de ususarios
app.get('/getAfiliados', authenticateToken, getDataController.getAfiliados___); // Lista de afiliados
app.get('/exportAfiliadosExcel', getDataController.exportAfiliadosExcel__); // Lista de afiliados

app.get('/getReporteCompleto', authenticateToken, getDataController.getReporteCompleto);
app.get('/getGraficoCasas', authenticateToken, getDataController.getGraficoCasas__);

// POST y PUT functions
app.post('/createUser', authenticateToken, PostDataController.userCreate__); //creacion de usuarios
app.put('/resetPass', authenticateToken, PostDataController.resetPassword__); // Reseteo password
app.put('/editField', authenticateToken, PostDataController.editField__); // Edit fields in data grid reports page (admin)

app.post('/uploadfile', upload.single('file'), ExcelController.uploadExcel);

app.delete('/deleteAfiliado/:id', authenticateToken, PostDataController.deleteField__);

app.delete(
  '/deleteUser/:id',
  authenticateToken,
  PostDataController.deleteUser__
); //delete user by id

/*
app.delete(
  '/deleteArchivoTxt/:id',
  authenticateToken,
  PostDataController.deleteArchivoTxt__
); //delete Archivos por id
*/


app.listen(port, () => {
  console.log('servidor funcionando en el puerto ' + port);
});
