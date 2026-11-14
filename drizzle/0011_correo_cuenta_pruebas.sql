-- La cuenta de pruebas pasa al dominio de la marca actual. Conserva su id, su contraseña y sus datos;
-- no hace nada si ya existe una cuenta con el correo nuevo.
UPDATE `user` SET `email` = 'pruebas@xgreenenergy.local'
WHERE `email` = 'pruebas@inworldenergy.local'
  AND NOT EXISTS (SELECT 1 FROM `user` WHERE `email` = 'pruebas@xgreenenergy.local');
