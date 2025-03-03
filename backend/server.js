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

app.use(cors());
app.use(express.json());

app.post('/loginUsers', authenticateToken, PostDataController.loginUsers__); // Login para obtener el token
//app.get('/getUserList', authenticateToken, getDataController.listUsers__); // Lista de ususarios
app.get('/getAfiliados', getDataController.getAfiliados___); // Lista de afiliados
app.get('/getReporteCompleto', authenticateToken, getDataController.getReporteCompleto);

// POST y PUT functions
app.post('/createUser', authenticateToken, PostDataController.userCreate__); //creacion de usuarios
app.put('/resetPass', authenticateToken, PostDataController.resetPassword__); // Reseteo password
app.put('/editField', authenticateToken, PostDataController.editField__); // Edit fields in data grid reports page (admin)

app.post('/uploadfile', upload.single('file'), ExcelController.uploadExcel);

app.delete('/deleteAfiliado/:id', authenticateToken, PostDataController.deleteField__);
/*
app.delete(
  '/deleteArchivoTxt/:id',
  authenticateToken,
  PostDataController.deleteArchivoTxt__
); //delete Archivos por id
*/

//app.post('/uploadfile', upload.single('file'), txtController.execFuncsTxt);

//app.post('/updateTxt', upload.single('file'), txtController.execUpdateTxt);

app.listen(port, () => {
  console.log('servidor funcionando en el puerto ' + port);
});
