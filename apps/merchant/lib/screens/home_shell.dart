import 'package:flutter/material.dart';

import '../core/session.dart';
import 'insights_screen.dart';
import 'orders_screen.dart';
import 'settings_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.session});

  final SessionController session;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    final businessId = session.businessId;
    final selected = session.selected;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              selected?.businessName ?? 'Iskina Business',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            if (selected?.vertical != null)
              Text(
                selected!.vertical!.toUpperCase(),
                style: const TextStyle(fontSize: 10, letterSpacing: 1.2),
              ),
          ],
        ),
        actions: [
          if (session.memberships.length > 1)
            PopupMenuButton<String>(
              icon: const Icon(Icons.storefront),
              onSelected: (value) {
                final membership = session.memberships.firstWhere(
                  (item) => item.businessId == value,
                );
                session.selectBusiness(membership);
              },
              itemBuilder: (context) => [
                for (final membership in session.memberships)
                  if (membership.businessId != null)
                    PopupMenuItem(
                      value: membership.businessId,
                      child: Text(membership.businessName ?? 'Business'),
                    ),
              ],
            ),
        ],
      ),
      body: businessId == null
          ? const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('No business is assigned to this account yet.'),
              ),
            )
          : IndexedStack(
              index: _index,
              children: [
                OrdersScreen(
                  key: ValueKey('orders-$businessId'),
                  session: session,
                  businessId: businessId,
                ),
                InsightsScreen(
                  key: ValueKey('insights-$businessId'),
                  session: session,
                  businessId: businessId,
                ),
                SettingsScreen(session: session),
              ],
            ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Orders',
          ),
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            selectedIcon: Icon(Icons.insights),
            label: 'Insights',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
