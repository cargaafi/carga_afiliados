require('dotenv').config();
const mysql = require('mysql2');
const pool = mysql.createPool(process.env.DATABASE_URL);
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const secretkey = process.env.JWT_SECRET;
const saltRounds = 10;

// El token solo guarda el id, asi que el rol se busca en la base. Nunca se
// confia en un rol que venga del cliente: cualquiera podria mandar "admin".
function usuarioDelToken(req) {
  return new Promise((resolve, reject) => {
    const id = req.user && req.user.id;
    if (!id) return resolve(null);
    pool.query(
      'SELECT id, username, role FROM users WHERE id = ?',
      [id],
      (error, filas) => {
        if (error) return reject(error);
        resolve(filas && filas.length ? filas[0] : null);
      }
    );
  });
}

// Guard para las rutas que solo puede tocar un administrador.
async function soloAdmin(req, res, next) {
  try {
    const actual = await usuarioDelToken(req);
    if (!actual || actual.role !== 'admin') {
      return res.status(403).json({
        code: 'NO_ADMIN',
        message: 'Esta acción es solo para administradores',
      });
    }
    req.usuarioActual = actual;
    next();
  } catch (error) {
    console.error('Error verificando el rol del usuario', error);
    return res.status(500).json({ message: 'No se pudo verificar el usuario' });
  }
}


// Func para validar usuarios , executamos eso esto en terminal para generar el key = node -e "console.log(require('crypto').randomBytes(256).toString('base64'))
function loginUsers__(req, res) {
  const username = req.body.username;
  const password = req.body.password;

  const selectLogin = 'SELECT * FROM users WHERE username = ?';

  pool.query(selectLogin, [username], (err, result) => {
    if (err) {
      console.error('Error in connection to DB to check bcrypt password', err);
      return res.status(500).send('Error al realizar la conexion bd para bcrypt password');
    }

    // Check if result is defined and has entries
    if (result && result.length > 0) {
      bcrypt.compare(password, result[0].password, (err, response) => {
        if (err) {
          console.error('Error comparing encrypted password', err);
          return res.status(500).send('Error to compare encrypt password');
        }

        if (response) {
          const token = jwt.sign({ id: result[0].id }, secretkey, {
            expiresIn: '1h'
          });
          res.send({
            token,
            id: result[0].id,
            username: result[0].username,
            role: result[0].role,
            nombre_completo: result[0].nombre_completo
          });
          console.log('Logging in user...', username);
        } else {
          res.send({ code: 'USR_INCOR' });
        }
      });
    } else {
      res.send({ code: 'USR_NOT_EXIST' });
    }
  });
}

// User create
function userCreate__(req, res) {
  const username = req.body.username;
  const role = req.body.role;
  const password = req.body.password;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: 'Usuario y contraseña son obligatorios' });
  }

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error('error in brypt.hash inside userCreate function', err);
    }

    const sqlCreateUser =
      'INSERT INTO users (username, role, password ) VALUES (?,?,?)';

    pool.query(sqlCreateUser, [username, role, hash], (error, result) => {
      if (error) {
        console.error(
          'Error in sqlCreateUser query..Check DB connection',
          error.code
        );

        if (error.code === 'ER_DUP_ENTRY') {
          res.status(500).json({
            code: 'USER_DUPLI',
            message: 'This user name already exists',
          });
        }
      } else {
        res.status(200).json('User create!');
      }
    });
  });
}

// Delete user
function deleteUser__(req, res) {
  const id = req.params.id;

  // soloAdmin ya dejo el usuario en req.usuarioActual: que no se borre a si
  // mismo, porque se quedaria sin forma de administrar el sistema.
  if (req.usuarioActual && String(req.usuarioActual.id) === String(id)) {
    return res
      .status(400)
      .json({ message: 'No puedes borrar tu propio usuario' });
  }

  const sqlDeleteUser = 'DELETE FROM users WHERE id = ?';

  pool.query(sqlDeleteUser, [id], (error, result) => {
    if (error) {
      console.error('Error in sqlDeleteUser query..Check DB connection', error);
      res
        .status(500)
        .json({ message: 'An error occurred while deleting the user' });
    } else {
      res.status(200).json({ message: 'Usuario borrado' });
    }
  });
}

// Reset password
async function resetPassword__(req, res) {
  const password = req.body.password;

  if (!password) {
    return res.status(400).json({ message: 'La contraseña no puede ir vacía' });
  }

  let actual;
  try {
    actual = await usuarioDelToken(req);
  } catch (error) {
    console.error('Error buscando el usuario del token', error);
    return res.status(500).json({ message: 'No se pudo verificar el usuario' });
  }
  if (!actual) return res.status(403).json({ message: 'Usuario no válido' });

  // Un usuario de casa solo puede cambiar SU propia contraseña. Si pide la de
  // otro se le dice que no: antes se le cambiaba la propia y se le respondia
  // "actualizada", que es mentirle sobre lo que paso.
  const pedido = req.body.username;
  if (actual.role !== 'admin' && pedido && pedido !== actual.username) {
    return res.status(403).json({
      code: 'NO_ADMIN',
      message: 'Solo puedes cambiar tu propia contraseña',
    });
  }
  const username = actual.role === 'admin' && pedido ? pedido : actual.username;

  bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
      console.error('error en brypt.hash dentro de resetpass function', err);
    }

    const updatePass = `UPDATE users SET password = ? WHERE username = ?`;
    pool.query(updatePass, [hash, username], (error, result) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ message: 'error', error });
      }
      if (result.affectedRows === 0) {
        return res
          .status(400)
          .json({ message: 'No rows updated. Check the ID.' });
      }
      return res.status(200).json({ message: 'Password actualizada' });
    });
  });
}


async function editField__(req, res) {
  const { id, field, newValue } = req.body;
  // Si newValue está vacío, asignamos un valor predeterminado.
  const valueToUpdate = (!newValue || newValue === '') ? 'N/A' : newValue;
  
  // Lista de campos permitidos para actualizar
  const allowedFields = ['casa', 'apellido_paterno', 'apellido_materno', 'nombre','telefono','seccion_electoral','municipio','entidad_federativa'];

  if (!allowedFields.includes(field)) {
    return res.status(400).json({ message: 'El la edición de este campo no está permitido' });
  }

  const editFieldQuery = `UPDATE afiliados SET ?? = ? WHERE clave_elector = ?`;
  pool.query(editFieldQuery, [field, valueToUpdate, id], (error, result) => {
    if (error) {
      console.error('Error al actualizar:', error);
      return res.status(500).json({ message: 'Error al actualizar el campo', error });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se actualizó ningún registro. Verifica el ID.' });
    }
    return res.status(200).json({ message: `${field} actualizado correctamente` });
  });
}

async function deleteField__(req,res ) {

  const { id } = req.body; // Se espera que 'id' sea la clave_elector

  if (!id) {
    return res.status(400).json({ message: 'Se requiere un ID (clave_elector)' });
  }

  try {
    const deleteQuery = 'DELETE FROM afiliados WHERE clave_elector = ?';
    const [result] = await pool.query(deleteQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No se encontró ningún registro con el ID proporcionado' });
    }

    return res.status(200).json({ message: 'Registro eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el afiliado:', error);
    return res.status(500).json({ message: 'Error al eliminar el afiliado', error });
  }
};

module.exports = {
  loginUsers__,
  resetPassword__,
  editField__,
  deleteUser__,
  userCreate__,
  soloAdmin,
  deleteField__
};
