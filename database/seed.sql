-- =====================================================================
--  Datos de ejemplo (ficticios). Los RUC cumplen el dígito verificador
--  módulo 11 de SUNAT pero no pertenecen a empresas reales.
-- =====================================================================
INSERT INTO proveedores (ruc, razon_social, contacto, telefono, email, direccion) VALUES
  ('20601122333', 'Lácteos del Valle del Mantaro S.A.C.', 'Rosa Quispe Huamán', '964112233', 'ventas@lacteosmantaro.pe', 'Av. Ferrocarril 1240, Huancayo'),
  ('20487654320', 'Molinera Andina E.I.R.L.', 'Jorge Ccanto Rojas', '954221100', 'pedidos@molineraandina.pe', 'Jr. Ancash 455, El Tambo'),
  ('20605544330', 'Bebidas Huaytapallana S.A.', 'Milagros Poma Torres', '987650011', 'comercial@huaytapallana.pe', 'Carretera Central km 5, Pilcomayo'),
  ('20609988771', 'Distribuidora Limpio Hogar S.A.C.', 'Luis Mendoza Yupanqui', '935778899', NULL, 'Av. Huancavelica 980, Chilca');

INSERT INTO productos (codigo, nombre, categoria, precio_centimos, stock, stock_minimo, proveedor_id) VALUES
  ('LAC-0001', 'Leche fresca entera 1 L',          'Lácteos',          450,  60, 10, 1),
  ('LAC-0002', 'Queso andino fresco 500 g',        'Lácteos',         1690,  18,  5, 1),
  ('LAC-0003', 'Yogurt de aguaymanto 1 L',         'Lácteos',          780,   4,  6, 1),
  ('ABA-0001', 'Harina de trigo preparada 1 kg',   'Abarrotes',        590,  45, 10, 2),
  ('ABA-0002', 'Quinua blanca perlada 1 kg',       'Abarrotes',       1250,  32,  8, 2),
  ('ABA-0003', 'Maca en polvo 250 g',              'Abarrotes',       1800,   3,  5, 2),
  ('BEB-0001', 'Agua de manantial 2.5 L',          'Bebidas',          350,  80, 20, 3),
  ('BEB-0002', 'Chicha morada lista 1 L',          'Bebidas',          600,  25, 10, 3),
  ('LIM-0001', 'Detergente en polvo 900 g',        'Limpieza',        1490,  22,  6, 4),
  ('LIM-0002', 'Lejía tradicional 1 L',            'Limpieza',         390,  40, 10, 4);

INSERT INTO clientes (tipo_documento, numero_documento, nombre, email, telefono, direccion) VALUES
  ('DNI', '45678912', 'María Elena Huamán Soto',     'maria.huaman@correo.pe', '987654321', 'Jr. Puno 320, Huancayo'),
  ('DNI', '70123456', 'Carlos Alberto Rojas Ninanya', NULL,                    '912345678', 'Av. Giráldez 610, Huancayo'),
  ('RUC', '20602233449', 'Bodega Santa Rosa S.A.C.', 'compras@bodegasantarosa.pe', '964998877', 'Av. Mariscal Castilla 2210, El Tambo'),
  ('RUC', '10445566778', 'Juana Pilar Ccente Ramos',  NULL,                     '943221100', 'Jr. Lima 115, Chupaca');

INSERT INTO ventas (tipo_comprobante, serie, correlativo, cliente_id, subtotal_centimos, igv_centimos, total_centimos, estado) VALUES
  ('BOLETA',  'B001', 1, 1, 2119, 381, 2500, 'EMITIDA'),
  ('FACTURA', 'F001', 1, 3, 11644, 2096, 13740, 'EMITIDA');

INSERT INTO venta_detalle (venta_id, producto_id, cantidad, precio_unitario_centimos, importe_centimos) VALUES
  (1, 1, 2, 450, 900),
  (1, 5, 1, 1250, 1250),
  (1, 7, 1, 350, 350),
  (2, 4, 10, 590, 5900),
  (2, 9, 5, 1490, 7450),
  (2, 10, 1, 390, 390);
