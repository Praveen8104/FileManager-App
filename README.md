# File Manager App

A secure, modern, and feature-rich **React Native file manager app** for Android and iOS.  
Supports local file & folder navigation, advanced file operations, theming, biometric authentication, global search, and much more.

## 🚀 Features

- **File & Folder Navigation**
  - Browse all files and folders within the app’s sandbox storage.
  - Grid and list view toggle.
  - Pull to refresh contents.

- **File & Folder Operations**
  - Create, rename, or delete files & folders.
  - Upload files using the device Document Picker.
  - Multi-select support for batch copy, move, share, or delete.
  - Robust multi-file clipboard with safe rename for overwrite protection.
  - Platform-adaptive file sharing (handles iOS & Android specifics).
  - File/folder details modal (size, modification time, type, path, MIME).

- **Search & Sort**
  - Fast, recursive global file/folder search.
  - Sort by name, date, or size.

- **Security**
  - Biometric lock (FaceID/fingerprint) with Expo Local Authentication.
  - Biometric and theme settings are saved locally using AsyncStorage.

- **User Experience**
  - Customizable dark & light themes with rich UI styling.
  - Floating action button for quick actions (upload, create folder).
  - Dedicated modals for actions, context menus, toasts, confirmation alerts, and settings.
  - Detailed and dynamic icons/colors based on file types.
  - Details preview for image files.

## 📲 Platform Details

- **Built with:**  
  - React Native  
  - Expo SDK (FileSystem, Sharing, IntentLauncher, LocalAuthentication, DocumentPicker)  
  - MaterialCommunityIcons

- **Supported Platforms:**  
  - Android  
  - iOS

## 🛠 Getting Started

### Prerequisites

- Node.js >= 16.x  
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. **Clone the Repository**

git clone https://github.com/Praveen8104/FileManager-App.git


2. **Install Dependencies**

npm install


3. **Run the App**

npx expo start




## 📂 Project Structure

- `HomeScreen.js`  
Main screen and logic for the file manager, including all features.

- `components/`  
All presentational sub-components (FileItem, FloatingActionButton, etc.).

- `utils/`  
Helper functions (bytes formatter, icon/color inference, etc.).

## 🔒 Security Notes

- **Files are managed within the sandboxed storage** (`expo-file-system` document directory) for privacy.
- **Biometric authentication** (if enabled) is required on app open.  
If authentication fails, the app closes immediately.
- **Files remain local on device;** sharing uses OS-level APIs.

## ⚡️ Highlights

- **Intuitive interface:** Touch-friendly, adaptive layout.
- **Smart clipboard:** Prevents duplicate overwrites with intelligent naming, allows cross-folder move/copy.
- **Global search:** Ultra-fast, recursive across all subfolders.
- **Highly customizable:** User toggle for dark mode and biometrics.
- **User-friendly batch actions:** Multi-select mode for organization and sharing.

## Contributing

Contributions, bug reports, and suggestions are welcome!  
Please open an issue or submit a pull request.

## Credits

Built using [Expo](https://expo.dev/), [React Native](https://reactnative.dev/), and [MaterialCommunityIcons](https://materialdesignicons.com/).

**Enjoy using a secure, fast, and flexible file manager on your device!**
