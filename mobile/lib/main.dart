import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/outbox_sync_service.dart';
import 'screens/voice_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => OutboxSyncService()),
      ],
      child: const CaseMobileApp(),
    ),
  );
}

class CaseMobileApp extends StatelessWidget {
  const CaseMobileApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CASE Móvil Offline-First',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.amber,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        fontFamily: 'Roboto',
      ),
      home: const VoiceHomeScreen(),
    );
  }
}
