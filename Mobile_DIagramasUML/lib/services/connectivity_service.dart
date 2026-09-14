import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';

class ConnectivityService {
  static final ConnectivityService instance = ConnectivityService._internal();
  final Connectivity _connectivity = Connectivity();
  final StreamController<bool> _connectionChangeController = StreamController<bool>.broadcast();

  bool _hasConnection = true;

  ConnectivityService._internal() {
    _connectivity.onConnectivityChanged.listen(_checkStatus);
    checkInitialConnection();
  }

  Stream<bool> get connectionStream => _connectionChangeController.stream;
  bool get hasConnection => _hasConnection;

  Future<bool> checkInitialConnection() async {
    final result = await _connectivity.checkConnectivity();
    _hasConnection = _isOnline(result);
    _connectionChangeController.add(_hasConnection);
    return _hasConnection;
  }

  void _checkStatus(List<ConnectivityResult> results) {
    final online = results.any((r) => r != ConnectivityResult.none);
    if (_hasConnection != online) {
      _hasConnection = online;
      _connectionChangeController.add(_hasConnection);
    }
  }

  bool _isOnline(List<ConnectivityResult> results) {
    return results.any((r) => r != ConnectivityResult.none);
  }

  // Simulación para pruebas en modo avión
  void simulateAirplaneMode(bool offline) {
    _hasConnection = !offline;
    _connectionChangeController.add(_hasConnection);
  }

  void dispose() {
    _connectionChangeController.close();
  }
}
