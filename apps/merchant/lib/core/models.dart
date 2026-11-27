class Membership {
  const Membership({
    required this.tenantId,
    required this.tenantName,
    required this.businessId,
    required this.businessName,
    required this.businessSlug,
    required this.vertical,
    required this.role,
  });

  final String tenantId;
  final String tenantName;
  final String? businessId;
  final String? businessName;
  final String? businessSlug;
  final String? vertical;
  final String role;

  factory Membership.fromJson(Map<String, dynamic> json) => Membership(
    tenantId: json['tenantId'] as String,
    tenantName: json['tenantName'] as String? ?? '',
    businessId: json['businessId'] as String?,
    businessName: json['businessName'] as String?,
    businessSlug: json['businessSlug'] as String?,
    vertical: json['vertical'] as String?,
    role: json['role'] as String? ?? 'staff',
  );
}

class MerchantUser {
  const MerchantUser({required this.id, required this.phone, this.name});

  final String id;
  final String phone;
  final String? name;

  factory MerchantUser.fromJson(Map<String, dynamic> json) => MerchantUser(
    id: json['id'] as String,
    phone: json['phone'] as String,
    name: json['name'] as String?,
  );
}

class VerifyResult {
  const VerifyResult({
    required this.token,
    required this.user,
    required this.memberships,
  });

  final String token;
  final MerchantUser user;
  final List<Membership> memberships;
}

class ThemeTokens {
  const ThemeTokens({
    required this.primary,
    required this.onPrimary,
    required this.accent,
    required this.onAccent,
    required this.surface,
    required this.surfaceMuted,
    required this.onSurface,
    required this.outline,
  });

  final String primary;
  final String onPrimary;
  final String accent;
  final String onAccent;
  final String surface;
  final String surfaceMuted;
  final String onSurface;
  final String outline;

  factory ThemeTokens.fromJson(Map<String, dynamic> json) => ThemeTokens(
    primary: json['primary'] as String? ?? '#FF6A00',
    onPrimary: json['onPrimary'] as String? ?? '#1A1A1A',
    accent: json['accent'] as String? ?? '#FFB300',
    onAccent: json['onAccent'] as String? ?? '#1A1A1A',
    surface: json['surface'] as String? ?? '#FFFDF9',
    surfaceMuted: json['surfaceMuted'] as String? ?? '#FFF4EA',
    onSurface: json['onSurface'] as String? ?? '#1A1A1A',
    outline: json['outline'] as String? ?? '#E8DED4',
  );

  static const fallbackLight = ThemeTokens(
    primary: '#FF6A00',
    onPrimary: '#1A1A1A',
    accent: '#FFB300',
    onAccent: '#1A1A1A',
    surface: '#FFFDF9',
    surfaceMuted: '#FFF4EA',
    onSurface: '#1A1A1A',
    outline: '#E8DED4',
  );

  static const fallbackDark = ThemeTokens(
    primary: '#FF8A3D',
    onPrimary: '#1A1A1A',
    accent: '#FFC94D',
    onAccent: '#1A1A1A',
    surface: '#12100E',
    surfaceMuted: '#1F1813',
    onSurface: '#F5EFE9',
    outline: '#3A3129',
  );
}

class ThemeManifest {
  const ThemeManifest({
    required this.version,
    required this.layout,
    required this.light,
    required this.dark,
  });

  final int version;
  final String layout;
  final ThemeTokens light;
  final ThemeTokens dark;

  factory ThemeManifest.fromJson(Map<String, dynamic> json) {
    final tokens = json['tokens'] as Map<String, dynamic>? ?? {};
    return ThemeManifest(
      version: (json['version'] as num?)?.toInt() ?? 1,
      layout: json['layout'] as String? ?? 'grid',
      light: ThemeTokens.fromJson(
        tokens['light'] as Map<String, dynamic>? ?? {},
      ),
      dark: ThemeTokens.fromJson(tokens['dark'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class OrderLine {
  const OrderLine({
    required this.id,
    required this.name,
    required this.quantity,
    required this.lineTotalCentavos,
  });

  final String id;
  final String name;
  final int quantity;
  final int lineTotalCentavos;

  factory OrderLine.fromJson(Map<String, dynamic> json) => OrderLine(
    id: json['id'] as String,
    name: json['name'] as String,
    quantity: (json['quantity'] as num).toInt(),
    lineTotalCentavos: (json['lineTotalCentavos'] as num).toInt(),
  );
}

class MerchantOrder {
  const MerchantOrder({
    required this.id,
    required this.number,
    required this.status,
    required this.kind,
    required this.totalCentavos,
    required this.contactName,
    required this.contactPhone,
    required this.address,
    required this.placedAt,
    required this.scheduledAt,
    required this.cashReceivedAt,
    required this.lines,
  });

  final String id;
  final String number;
  final String status;
  final String kind;
  final int totalCentavos;
  final String? contactName;
  final String contactPhone;
  final String? address;
  final DateTime placedAt;
  final DateTime? scheduledAt;
  final DateTime? cashReceivedAt;
  final List<OrderLine> lines;

  factory MerchantOrder.fromJson(
    Map<String, dynamic> order,
    List<dynamic> lines,
  ) => MerchantOrder(
    id: order['id'] as String,
    number: order['number'] as String,
    status: order['status'] as String,
    kind: order['kind'] as String,
    totalCentavos: (order['totalCentavos'] as num).toInt(),
    contactName: order['contactName'] as String?,
    contactPhone: order['contactPhone'] as String? ?? '',
    address: order['address'] as String?,
    placedAt: DateTime.parse(order['placedAt'] as String),
    scheduledAt: order['scheduledAt'] == null
        ? null
        : DateTime.parse(order['scheduledAt'] as String),
    cashReceivedAt: order['cashReceivedAt'] == null
        ? null
        : DateTime.parse(order['cashReceivedAt'] as String),
    lines: lines
        .map((line) => OrderLine.fromJson(line as Map<String, dynamic>))
        .toList(),
  );
}

int _int(dynamic value) => (value as num?)?.toInt() ?? 0;

class AnalyticsSnapshot {
  const AnalyticsSnapshot({
    required this.gmvCentavos,
    required this.netSalesCentavos,
    required this.ordersPlaced,
    required this.ordersCompleted,
    required this.aovCentavos,
    required this.acceptanceRate,
    required this.prepP50Seconds,
    required this.fulfillmentP90Seconds,
    required this.series,
    required this.topItems,
    required this.hours,
  });

  final int gmvCentavos;
  final int netSalesCentavos;
  final int ordersPlaced;
  final int ordersCompleted;
  final int aovCentavos;
  final double? acceptanceRate;
  final double? prepP50Seconds;
  final double? fulfillmentP90Seconds;
  final List<dynamic> series;
  final List<dynamic> topItems;
  final List<dynamic> hours;

  factory AnalyticsSnapshot.fromJson(Map<String, dynamic> json) {
    final totals = json['totals'] as Map<String, dynamic>? ?? {};
    return AnalyticsSnapshot(
      gmvCentavos: _int(totals['gmvCentavos']),
      netSalesCentavos: _int(totals['netSalesCentavos']),
      ordersPlaced: _int(totals['ordersPlaced']),
      ordersCompleted: _int(totals['ordersCompleted']),
      aovCentavos: _int(totals['aovCentavos']),
      acceptanceRate: (totals['acceptanceRate'] as num?)?.toDouble(),
      prepP50Seconds: (totals['prepP50Seconds'] as num?)?.toDouble(),
      fulfillmentP90Seconds: (totals['fulfillmentP90Seconds'] as num?)
          ?.toDouble(),
      series: json['series'] as List<dynamic>? ?? const [],
      topItems: json['topItems'] as List<dynamic>? ?? const [],
      hours: json['hours'] as List<dynamic>? ?? const [],
    );
  }
}
