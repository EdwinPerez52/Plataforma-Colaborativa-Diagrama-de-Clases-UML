class ApiConstants {
  // Para emulador Android estándar, 10.0.2.2 mapea a localhost de la máquina host
  static const String baseUrlAndroid = 'http://10.0.2.2:8080/api/v1';
  static const String baseUrlIos = 'http://localhost:8080/api/v1';
  static const String baseUrlNodeServer = 'http://10.0.2.2:4000/api/v1';

  // Timeout para considerar falla de red y mantener en Outbox
  static const Duration connectionTimeout = Duration(seconds: 4);

  // Intervalo de reintento de sincronización automática
  static const Duration syncInterval = Duration(seconds: 15);
}
