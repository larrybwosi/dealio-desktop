# Dealio Desktop

A modern, cross-platform Point of Sale (POS) desktop application built with Tauri, React, and TypeScript. Dealio Desktop provides a comprehensive solution for managing sales, inventory, customers, and analytics across multiple business types.

## 🚀 Features

### Core Functionality
- **Multi-Business Support**: Pre-configured templates for 12 business types including restaurants, cafes, retail stores, pharmacies, grocery stores, and more
- **Point of Sale**: Fast and intuitive checkout process with product search, cart management, and multiple payment methods
- **Inventory Management**: Track stock levels, manage product variants, batch tracking, and expiry dates
- **Customer Management**: Maintain customer records, track purchase history, and manage loyalty programs
- **Order Management**: Handle different order types (dine-in, takeaway, delivery, pickup, online)
- **Sales Analytics**: Comprehensive reporting and analytics dashboard with charts and insights
- **Receipt Customization**: Fully customizable receipt templates with PDF generation
- **Cash Drawer Management**: Track cash flow, withdrawals, and till reconciliation

### Business-Specific Features
- **Table Management** (Restaurants, Cafes, Bars): Manage dining tables and orders
- **Kitchen Display System** (Restaurants, Bars): Real-time order display for kitchen staff
- **Prescription Management** (Pharmacies): Handle prescription orders and doctor information
- **ISBN Tracking** (Bookshops): Track books by ISBN
- **Warranty Tracking** (Electronics, Hardware): Manage product warranties
- **Age Verification** (Bars): Built-in age verification for alcohol sales
- **B2B Bulk Purchase** (Wholesale, Retail): Support for bulk orders and wholesale pricing
- **Size Variants** (Cafes, Clothing): Manage product sizes and variants

### Technical Features
- **Offline-First**: Works without internet connection with local data storage
- **Real-time Notifications**: Ably-powered notification system for order updates
- **Auto-Updates**: Built-in update mechanism for seamless version upgrades
- **Multi-Location Support**: Manage multiple business locations
- **Member Check-in/Check-out**: Staff authentication and session management
- **Printer Integration**: Direct thermal printer support for receipts
- **HID Device Support**: Integration with barcode scanners and other HID devices
- **Deep Linking**: Support for external app integration
- **Secure Storage**: Encrypted local storage using Tauri Stronghold

## 🛠️ Tech Stack

### Frontend
- **React 19** - UI framework
- **TypeScript** - Type-safe development
- **React Router 7** - Client-side routing
- **Zustand** - State management
- **TanStack Query** - Server state management
- **Tailwind CSS 4** - Styling
- **Radix UI** - Accessible component primitives
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **React Hook Form + Zod** - Form validation

### Backend/Desktop
- **Tauri 2** - Cross-platform desktop framework
- **Rust** - Native backend
- **Vite** - Build tool and dev server

### Key Libraries
- **Axios** - HTTP client
- **Ably** - Real-time notifications
- **@react-pdf/renderer** - PDF generation
- **date-fns** - Date manipulation
- **Sonner** - Toast notifications
- **QRCode** - QR code generation

## 📋 Prerequisites

- **Node.js** 18+ and pnpm
- **Rust** 1.70+ (for Tauri)
- **Windows**, **macOS**, or **Linux**

## 🚀 Getting Started

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/larrybwosi/dealio-desktop.git
   cd dealio-desktop
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run in development mode**
   ```bash
   pnpm tauri dev
   ```

### Building for Production

```bash
# Build the application
pnpm exe

# Or use the Tauri CLI directly
pnpm tauri build
```

The built application will be available in `src-tauri/target/release/`.

## 📱 Usage

### Initial Setup

1. **Device Registration**: On first launch, register the device with your API key and select a business location
2. **Business Type Selection**: Choose your business type from the available templates (restaurant, cafe, retail, etc.)
3. **Member Check-in**: Staff members check in using their credentials to start a session

### Daily Operations

1. **Taking Orders**
   - Browse products by category
   - Add items to cart
   - Apply discounts
   - Select customer (optional)
   - Process payment (cash, M-Pesa, card)
   - Print receipt

2. **Managing Inventory**
   - Add/edit products
   - Track stock levels
   - Set low stock alerts
   - Manage product variants

3. **Viewing Analytics**
   - Daily/weekly/monthly sales reports
   - Top-selling products
   - Revenue trends
   - Customer insights

4. **End of Day**
   - Cash drawer reconciliation
   - View pending transactions
   - Generate reports
   - Member check-out

## 🔧 Configuration

### Business Configuration

Each business type comes with pre-configured settings that can be customized:

- Order types (dine-in, takeaway, delivery, etc.)
- Default product categories
- Tax settings
- Required customer fields
- Feature toggles

Edit configurations in `src/lib/business-configs.ts`.

### Receipt Settings

Customize receipt appearance:
- Header/footer text
- Logo
- Business information
- Template style
- Border options

Access via **Settings** → **Receipt Settings** in the app.

### Printer Setup

Configure thermal printers:
1. Navigate to **Settings** → **Printer Settings**
2. Select your printer from the detected devices
3. Test print to verify configuration

## 🏗️ Project Structure

```
dealio-desktop/
├── src/
│   ├── components/       # React components
│   │   ├── pos/         # POS-specific components
│   │   └── ui/          # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions and configs
│   ├── pages/           # Page components
│   ├── store/           # Zustand state stores
│   ├── types/           # TypeScript type definitions
│   └── App.tsx          # Main application component
├── src-tauri/           # Tauri/Rust backend
│   ├── src/             # Rust source code
│   ├── icons/           # Application icons
│   └── Cargo.toml       # Rust dependencies
├── public/              # Static assets
└── package.json         # Node dependencies
```

## 🔌 API Integration

Dealio Desktop integrates with a backend API for:
- Product synchronization
- Customer data
- Order processing
- Analytics
- M-Pesa payment processing

Configure API endpoints in your environment settings.

## 🧪 Development

### Available Scripts

```bash
# Start development server
pnpm dev

# Start Tauri development mode
pnpm tauri dev

# Build for production
pnpm build

# Build executable
pnpm exe

# Preview production build
pnpm preview
```

### Code Style

The project uses:
- **Prettier** for code formatting (`.prettierrc`)
- **TypeScript** for type checking
- **ESLint** (configured via Vite)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🐛 Known Issues

- Pending transactions sync may require manual retry in offline mode
- Some thermal printers may require specific driver configurations
- M-Pesa integration requires valid API credentials

## 🗺️ Roadmap

- [ ] Multi-currency support
- [ ] Advanced inventory forecasting
- [ ] Employee performance tracking
- [ ] Customer loyalty program enhancements
- [ ] Mobile companion app
- [ ] Cloud backup and sync
- [ ] Advanced reporting and exports
- [ ] Multi-language support

## 📞 Support

For issues, questions, or feature requests, please:
- Open an issue on GitHub
- Contact support at your-email@example.com

## 🙏 Acknowledgments

- Built with [Tauri](https://tauri.app/)
- UI components from [Radix UI](https://www.radix-ui.com/)
- Icons from [Lucide](https://lucide.dev/)
- Inspired by modern POS systems

---

**Version**: 0.1.0  
**Last Updated**: November 2025
