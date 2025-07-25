import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    Modal,
    TextInput,
    Pressable,
    ActivityIndicator,
    BackHandler,
    Linking,
    Platform,
    StatusBar,
    Dimensions,
    Switch,
    Image,
    RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView as SafeAreaContextView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';

// --- CONSTANTS & HELPERS ---

const APP_STORAGE_ROOT = FileSystem.documentDirectory;
const { width } = Dimensions.get('window');
const ITEM_MARGIN = 10;
const NUM_COLUMNS = 2;
const ITEM_SIZE = (width - ITEM_MARGIN * 3) / NUM_COLUMNS;

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};
const formatTimestamp = (unixTimestamp) => {
    const date = new Date(unixTimestamp * 1000);
    return date.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const getMimeType = (extension) => {
    const mimeTypes = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
        bmp: 'image/bmp', webp: 'image/webp', pdf: 'application/pdf',
        doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        zip: 'application/zip', rar: 'application/x-rar-compressed', tar: 'application/x-tar',
        gzip: 'application/gzip', csv: 'text/csv', xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
        ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        txt: 'text/plain', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4',
        mov: 'video/quicktime', avi: 'video/x-msvideo'
    };
    return mimeTypes[extension.toLowerCase()] || '*/*';
};
const getIconForFileType = (extension) => {
    const fileIcons = {
        jpg: 'file-image-outline', jpeg: 'file-image-outline', png: 'file-image-outline',
        gif: 'image-outline', bmp: 'image-outline', webp: 'image-outline',
        pdf: 'file-pdf-box', doc: 'file-word-outline', docx: 'file-word-outline',
        xls: 'file-excel-outline', xlsx: 'file-excel-outline', ppt: 'file-powerpoint-outline',
        pptx: 'file-powerpoint-outline', txt: 'file-document-outline', csv: 'file-delimited-outline',
        zip: 'zip-box-outline', rar: 'zip-box-outline', tar: 'zip-box-outline',
        gzip: 'zip-box-outline', mp3: 'file-music-outline', wav: 'file-music-outline',
        mp4: 'file-video-outline', mov: 'file-video-outline', avi: 'file-video-outline'
    };
    return fileIcons[extension.toLowerCase()] || 'file-outline';
};
const getColorForFileType = (extension) => {
    const fileColors = {
        jpg: '#E91E63', jpeg: '#E91E63', png: '#E91E63',
        gif: '#E91E63', bmp: '#E91E63', webp: '#E91E63',
        pdf: '#D32F2F', doc: '#2196F3', docx: '#2196F3',
        xls: '#4CAF50', xlsx: '#4CAF50', ppt: '#FF9800',
        pptx: '#FF9800', txt: '#607D8B', csv: '#009688',
        zip: '#795548', rar: '#795548', tar: '#795548',
        gzip: '#795548', mp3: '#9C27B0', wav: '#9C27B0',
        mp4: '#673AB7', mov: '#673AB7', avi: '#673AB7'
    };
    return fileColors[extension.toLowerCase()] || '#8A8A8E';
};
const getCurrentFolderName = (path) => {
    if (path === APP_STORAGE_ROOT) return 'Home';
    // Folder name is the second last segment (path ends with '/')
    const segments = path.split('/').filter(Boolean);
    return segments.length > 0 ? segments[segments.length - 1] : 'Home';
};

const isImageFile = (extension) => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
    return imageExtensions.includes(extension.toLowerCase());
};

// --- CUSTOM ALERT COMPONENT ---

const CustomAlert = ({ visible, title, message, buttons, styles }) => {
    if (!visible) return null;
    return (
        <Modal visible transparent animationType="fade">
            <Pressable style={styles.modalBackdrop} onPress={buttons[0]?.onPress}>
                <Pressable style={styles.customAlertContainer} onPress={e => e.stopPropagation()}>
                    {title ? <Text style={styles.customAlertTitle}>{title}</Text> : null}
                    {message ? <Text style={styles.customAlertMessage}>{message}</Text> : null}
                    <View style={styles.customAlertButtons}>
                        {buttons.map((btn, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[styles.customAlertButton, btn.style]}
                                onPress={btn.onPress}
                                activeOpacity={0.7}>
                                <Text style={[styles.customAlertButtonText, btn.textStyle]}>{btn.text}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

// --- UI SUB-COMPONENTS ---

const FileItem = ({ item, viewMode, isSelected, isMultiSelectMode, onLongPress, onPress, onMenuPress, styles, COLORS }) => {
    const itemStyle = viewMode === 'list' ? styles.itemContainerList : styles.itemContainerGrid;
    const isFolder = item.isDirectory;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={({ pressed }) => [
                itemStyle,
                pressed && styles.itemPressed,
                isSelected && styles.itemSelected
            ]}
        >
            {isImageFile(item.extension) ? (
                <Image source={{ uri: item.path }} style={viewMode === 'list' ? styles.itemImage : styles.itemImageGrid} />
            ) : (
                <Icon
                    name={isFolder ? 'folder-outline' : getIconForFileType(item.extension)}
                    size={viewMode === 'list' ? 40 : 80}
                    color={isFolder ? COLORS.folder : getColorForFileType(item.extension)}
                />
            )}

            <Text
                style={[
                    styles.itemName,
                    viewMode === 'grid' && styles.itemNameGrid,
                    isSelected && styles.itemSelectedText
                ]}
                numberOfLines={2}
            >
                {item.name}
            </Text>

            {isMultiSelectMode ? (
                <Icon
                    name={isSelected ? 'check-circle' : 'checkbox-blank-circle-outline'}
                    size={24}
                    color={isSelected ? COLORS.accent : COLORS.icon}
                    style={viewMode === 'list' ? styles.selectionIcon : styles.selectionIconGrid}
                />
            ) : (
                viewMode === 'list' && (
                    <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
                        <Icon name="dots-vertical" size={24} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                )
            )}
        </Pressable>
    );
};

const FloatingActionButton = ({ isOpen, onToggle, onAction, styles, COLORS, bottomOffset = 35 }) => {
    return (
        <View style={[styles.fabContainer, { bottom: bottomOffset }]}>
            {isOpen && (
                <View style={styles.fabSubMenu}>
                    <TouchableOpacity
                        style={[styles.fabSecondary, { backgroundColor: COLORS.accent }]}
                        onPress={() => onAction('upload')}
                    >
                        <Icon name="upload-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.fabSecondary, { backgroundColor: COLORS.accent }]}
                        onPress={() => onAction('create')}
                    >
                        <Icon name="folder-plus-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
            <TouchableOpacity style={styles.fab} onPress={onToggle}>
                <Icon name={isOpen ? 'close' : 'plus'} size={30} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

// --- MAIN APP COMPONENT ---

export default function HomeScreen() {
    // --- State Definitions ---
    const [theme, setTheme] = useState('light');
    const [biometricEnabled, setBiometricEnabled] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentPath, setCurrentPath] = useState(APP_STORAGE_ROOT);
    const [directoryContent, setDirectoryContent] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchVisible, setSearchVisible] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [viewMode, setViewMode] = useState('list');
    const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
    const [sortMenuVisible, setSortMenuVisible] = useState(false);
    const [inputModal, setInputModal] = useState({ visible: false, type: 'create', item: null });
    const [itemName, setItemName] = useState('');
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, item: null, x: 0, y: 0 });
    const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
    const [clipboard, setClipboard] = useState({ items: [], action: null });
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [alertState, setAlertState] = useState({ visible: false, title: '', message: '', buttons: [] });
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [isGlobalSearch, setIsGlobalSearch] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [toast, setToast] = useState({ visible: false, message: '' });
    const [detailsItem, setDetailsItem] = useState(null);
    const [selectedItemsSize, setSelectedItemsSize] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- Show Context Menu ---
    const showContextMenu = (item, event) => {
        const { pageX, pageY } = event.nativeEvent;
        const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

        // Estimate menu size to prevent it from going off-screen
        const itemHeight = 50; // Approximate height of a single menu item
        const menuHeight = itemHeight * 6; // 6 items in the menu

        let x = pageX;
        let y = pageY;

        // Adjust position if it overflows horizontally
        if (pageX + (width * 0.55) > screenWidth) {
            x = screenWidth - (width * 0.55) - 20;
        }

        // Adjust position if it overflows vertically. If not enough space below, open upwards.
        if (pageY + menuHeight > screenHeight) {
            y = pageY - menuHeight;
        }

        // Ensure the menu doesn't go off the top of the screen when opening upwards
        if (y < 0) {
            y = 10; // Add a small padding from the top
        }

        setContextMenu({ visible: true, item, x, y });
    };

    const showDetails = (item) => {
        setDetailsItem(item);
        setContextMenu({ visible: false });
    };

    // --- Theme & Styles ---
    const toggleTheme = async () => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        try {
            await AsyncStorage.setItem('theme', newTheme);
        } catch (e) {
            showAlert('Error', 'Failed to save theme setting.');
        }
    };
    const toggleBiometrics = async () => {
        const newValue = !biometricEnabled;
        setBiometricEnabled(newValue);
        try {
            await AsyncStorage.setItem('biometricEnabled', JSON.stringify(newValue));
        } catch (e) {
            showAlert('Error', 'Failed to save biometric setting.');
        }
    };

    const lightColors = {
        primary: '#4A90E2',
        background: '#F5F7FA',
        surface: '#FFFFFF',
        textPrimary: '#2C3E50',
        textSecondary: '#7F8C8D',
        accent: '#E67E22',
        destructive: '#E74C3C',
        folder: '#F39C12',
        icon: '#95A5A6',
        border: '#DADFE1',
        headerButton: '#FFFFFF',
        inputBackground: '#ECF0F1',
        modalButtonCancelText: '#34495E',
    };
    const darkColors = {
        primary: '#34495E',
        background: '#2C3E50',
        surface: '#34495E',
        textPrimary: '#ECF0F1',
        textSecondary: '#95A5A6',
        accent: '#E67E22',
        destructive: '#C0392B',
        folder: '#F39C12',
        icon: '#BDC3C7',
        border: '#7F8C8D',
        headerButton: '#ECF0F1',
        inputBackground: '#34495E',
        modalButtonCancelText: '#BDC3C7',
    };
    const COLORS = theme === 'light' ? lightColors : darkColors;

    const styles = useMemo(() => getStyles(COLORS, viewMode), [theme, viewMode]);

    // --- Authentication on mount ---

    useEffect(() => {
        if (!settingsLoaded) return;
        (async () => {
            if (!biometricEnabled) {
                setIsAuthenticated(true);
                return;
            }
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const supported = await LocalAuthentication.isEnrolledAsync();
            if (!hasHardware || !supported) {
                setIsAuthenticated(true);
                return;
            }
            const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to access Secure Files' });
            if (result.success) setIsAuthenticated(true);
            else BackHandler.exitApp();
        })();
    }, [biometricEnabled, settingsLoaded]);

    // --- BackHandler ---

    useEffect(() => {
        const backAction = () => {
            if (isFabMenuOpen) {
                setIsFabMenuOpen(false);
                return true;
            }
            if (sortMenuVisible) {
                setSortMenuVisible(false);
                return true;
            }
            if (headerMenuVisible) {
                setHeaderMenuVisible(false);
                return true;
            }
            if (contextMenu.visible) {
                setContextMenu({ visible: false });
                return true;
            }
            if (isMultiSelectMode) {
                exitMultiSelectMode();
                return true;
            }
            if (searchVisible) {
                setSearchVisible(false);
                setSearchQuery('');
                setIsGlobalSearch(false);
                setSearchResults([]);
                return true;
            }
            if (settingsVisible) {
                setSettingsVisible(false);
                return true;
            }
            if (currentPath !== APP_STORAGE_ROOT) {
                const parentPath = currentPath.substring(0, currentPath.slice(0, -1).lastIndexOf('/') + 1);
                setCurrentPath(parentPath);
                // Do NOT clear clipboard here to persist copy/move across folders.
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [currentPath, isMultiSelectMode, contextMenu.visible, sortMenuVisible, isFabMenuOpen, searchVisible, clipboard, settingsVisible, headerMenuVisible]);

    // --- Directory Reading ---

    const readDirectory = useCallback(async (path) => {
        setIsLoading(true);
        setDirectoryContent([]);
        try {
            let result = await FileSystem.readDirectoryAsync(path);
            result = result.filter(name => !name.startsWith('.') && name !== 'expo-file-system' && !name.startsWith('RCTAsyncLocalStorage'));
            const itemsWithStats = await Promise.all(
                result.map(async (name) => {
                    const itemPath = `${path.replace(/\/?$/, '/')}${name}`;
                    const info = await FileSystem.getInfoAsync(itemPath, { size: true });
                    const extension = !info.isDirectory && name.includes('.') ? name.split('.').pop() : '';
                    return {
                        name,
                        path: itemPath,
                        isDirectory: info.isDirectory,
                        extension,
                        size: info.size || 0,
                        modificationTime: info.modificationTime || 0,
                    };
                })
            );
            setDirectoryContent(itemsWithStats);
        } catch (error) {
            showAlert('Error', 'Could not read directory.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setIsRefreshing(true);
        await readDirectory(currentPath);
        setIsRefreshing(false);
    }, [currentPath, readDirectory]);

    useEffect(() => {
        if (isAuthenticated && !isGlobalSearch) readDirectory(currentPath);
    }, [currentPath, isAuthenticated, isGlobalSearch, readDirectory]);

    // --- Sorting & Filtering ---

    const sortedDirectoryContent = useMemo(() => {
        const content = isGlobalSearch ? searchResults : directoryContent;
        return [...content].sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            const dir = sortConfig.direction === 'asc' ? 1 : -1;
            switch (sortConfig.key) {
                case 'name':
                    return a.name.localeCompare(b.name) * dir;
                case 'size':
                    return (a.size - b.size) * dir;
                case 'date':
                    return (a.modificationTime - b.modificationTime) * dir;
                default:
                    return 0;
            }
        });
    }, [directoryContent, searchResults, sortConfig, isGlobalSearch]);

    const filteredContent = useMemo(() => {
        // The content is now determined by whether a global search is active or not.
        // Local, live filtering is removed to avoid confusion.
        return sortedDirectoryContent;
    }, [sortedDirectoryContent]);

    // --- Utils ---

    const exitMultiSelectMode = () => {
        setIsMultiSelectMode(false);
        setSelectedItems([]);
    };

    // --- Upload Handler ---

    const handleUploadFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true });
            if (result.canceled || !result.assets || result.assets.length === 0) {
                // User cancelled the picker
                return;
            }

            let uploadedCount = 0;
            let failedCount = 0;
            let existingFiles = [];

            for (const file of result.assets) {
                const destinationPath = `${currentPath.replace(/\/?$/, '/')}${file.name}`;
                const exists = await FileSystem.getInfoAsync(destinationPath);

                if (exists.exists) {
                    failedCount++;
                    existingFiles.push(file.name);
                } else {
                    await FileSystem.copyAsync({ from: file.uri, to: destinationPath });
                    uploadedCount++;
                }
            }

            readDirectory(currentPath);

            if (uploadedCount > 0) {
                showToast(`${uploadedCount} file(s) uploaded successfully`);
            }

            if (failedCount > 0) {
                showAlert('Upload Skipped', `Could not upload ${failedCount} file(s) because they already exist: \n\n${existingFiles.join('\n')}`);
            }

        } catch (err) {
            showAlert('Error', 'An error occurred while uploading files.');
        }
    };

    // --- Modal Handlers ---

    const openInputModal = (type, item = null) => {
        setContextMenu({ visible: false });
        setInputModal({ visible: true, type, item });
        if (type === 'rename' && item) setItemName(item.name);
        else setItemName('');
    };

    const handleModalSubmit = async () => {
        const { type, item } = inputModal;
        const trimmedName = itemName.trim();
        if (!trimmedName) {
            showAlert('Validation Error', 'Name cannot be empty.');
            return;
        }
        try {
            if (type === 'create') {
                const newPath = `${currentPath.replace(/\/?$/, '/')}${trimmedName}/`;
                const exists = await FileSystem.getInfoAsync(newPath);
                if (exists.exists) {
                    showAlert('Error', 'Folder already exists with this name.');
                    return;
                }
                await FileSystem.makeDirectoryAsync(newPath, { intermediates: true });
            } else if (type === 'rename' && item) {
                const newPath = item.path.substring(0, item.path.lastIndexOf('/') + 1) + trimmedName + (item.isDirectory ? '/' : '');
                const exists = await FileSystem.getInfoAsync(newPath);
                if (exists.exists) {
                    showAlert('Error', 'An item with that name already exists.');
                    return;
                }
                await FileSystem.moveAsync({ from: item.path, to: newPath });
            }
            setInputModal({ visible: false, item: null });
            setItemName('');
            if (isGlobalSearch && searchResults.length > 0) {
                setIsGlobalSearch(false);
                setSearchResults([]);
            }
            readDirectory(currentPath);
        } catch (e) {
            showAlert('Error', `Failed to ${type} item. It might already exist.`);
        }
    };

    // --- File/Folder Item Handlers ---

    const handleItemPress = (item) => {
        if (isMultiSelectMode) {
            const newSelected = selectedItems.includes(item.path)
                ? selectedItems.filter(p => p !== item.path)
                : [...selectedItems, item.path];

            if (newSelected.length === 0) {
                exitMultiSelectMode();
            } else {
                setSelectedItems(newSelected);
                const allContent = isGlobalSearch ? searchResults : directoryContent;
                const newSelectedItemsInfo = allContent.filter(i => newSelected.includes(i.path));
                const newSize = newSelectedItemsInfo.reduce((acc, curr) => acc + (curr.size || 0), 0);
                setSelectedItemsSize(newSize);
            }
        } else {
            if (item.isDirectory) {
                setCurrentPath(item.path.endsWith('/') ? item.path : `${item.path}/`);
            } else {
                handleFileAction(item, 'open');
            }
        }
    };

    const handleItemLongPress = (item, event) => {
        setIsMultiSelectMode(true);
        setSelectedItems([item.path]);
        setSelectedItemsSize(item.size || 0);
    };

    // --- File Actions ---

    const handleFileAction = async (item, action) => {
        setContextMenu({ visible: false });
        if (item.isDirectory && action !== 'delete' && action !== 'rename') return;
        try {
            if (action === 'share') {
                await Sharing.shareAsync(item.path);
            } else if (action === 'open') {
                const uri = await FileSystem.getContentUriAsync(item.path);
                const mimeType = getMimeType(item.extension);
                if (Platform.OS === 'android') {
                    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: uri, flags: 1, type: mimeType });
                } else {
                    await Linking.openURL(uri);
                }
            }
        } catch (e) {
            showAlert('Error', 'No application available to perform this action.');
        }
    };

    // --- Delete Handlers ---

    const handleDelete = (item) => {
        setContextMenu({ visible: false });
        showAlert(`Delete ${item.isDirectory ? 'Folder' : 'File'}?`, `'${item.name}' will be permanently deleted.`, [
            { text: 'Cancel', style: 'cancel', onPress: () => setAlertState(prev => ({ ...prev, visible: false })) },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await FileSystem.deleteAsync(item.path, { idempotent: true });
                        readDirectory(currentPath);
                    } catch (e) {
                        showAlert('Error', 'Failed to delete item.');
                    }
                    setAlertState(prev => ({ ...prev, visible: false }));
                },
            },
        ]);
    };

    const handleDeleteSelected = () => {
        showAlert(`Delete ${selectedItems.length} item(s)?`, `This action cannot be undone.`, [
            { text: 'Cancel', style: 'cancel', onPress: () => setAlertState(prev => ({ ...prev, visible: false })) },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await Promise.all(selectedItems.map(path => FileSystem.deleteAsync(path, { idempotent: true })));
                        readDirectory(currentPath);
                        exitMultiSelectMode();
                    } catch (e) {
                        showAlert('Error', 'Failed to delete some items.');
                    }
                    setAlertState(prev => ({ ...prev, visible: false }));
                },
            },
        ]);
    };

    // --- Sharing Multiple Files ---

    const handleShareSelected = async () => {
        if (selectedItems.length === 0) return;
        if (Platform.OS === 'ios') {
            try {
                await Sharing.shareAsync(selectedItems, { dialogTitle: `Share ${selectedItems.length} items` });
            } catch {
                showAlert('Error', 'Could not share files.');
            }
            return;
        }
        showAlert(
            'Sharing Multiple Files',
            `Android requires sharing files one by one. You will be prompted ${selectedItems.length} times.`,
            [
                { text: 'Cancel', style: 'cancel', onPress: () => setAlertState(prev => ({ ...prev, visible: false })) },
                {
                    text: 'Continue',
                    onPress: async () => {
                        for (const fileUri of selectedItems) {
                            try {
                                await new Promise(resolve => setTimeout(resolve, 500));
                                await Sharing.shareAsync(fileUri);
                            } catch (error) {
                                // ignore cancellations
                            }
                        }
                        setAlertState(prev => ({ ...prev, visible: false }));
                    },
                },
            ]
        );
    };

    // --- Select All Items ---

    const handleSelectAll = () => {
        setHeaderMenuVisible(false);
        const allItemPaths = (isGlobalSearch ? searchResults : directoryContent).map(item => item.path);
        if (allItemPaths.length > 0) {
            setIsMultiSelectMode(true);
            setSelectedItems(allItemPaths);
        }
    };

    // --- Clipboard (Copy/Move) ---

    // Support storing full items to clipboard for access to name, path, isDirectory
    const handleClipboardAction = (action, items) => {
        setClipboard({ items, action });
        exitMultiSelectMode();
        setContextMenu({ visible: false });
    };

    const handlePaste = async () => {
        const { items: sourceItems, action } = clipboard;
        if (!sourceItems.length || !action) return;

        try {
            // Build new list to avoid overwriting existing items by appending number suffix if needed
            for (const srcItem of sourceItems) {
                const baseName = srcItem.name.replace(/(\(\d+\))?$/, '');
                let suffixIndex = 0;
                let destPath;
                do {
                    const suffix = suffixIndex === 0 ? '' : `(${suffixIndex})`;
                    destPath = `${currentPath.replace(/\/?$/, '/')}${baseName}${suffix}${srcItem.isDirectory ? '/' : ''}`;
                    const info = await FileSystem.getInfoAsync(destPath);
                    if (!info.exists) break;
                    suffixIndex++;
                    if (suffixIndex > 50) throw new Error('Too many duplicates, aborting paste.');
                } while (true);

                // Check for moving folder into itself
                if (
                    action === 'move' &&
                    srcItem.isDirectory &&
                    currentPath.startsWith(srcItem.path)
                ) {
                    throw new Error('Cannot paste a folder into itself.');
                }

                if (action === 'copy') {
                    await FileSystem.copyAsync({ from: srcItem.path, to: destPath });
                } else {
                    // move
                    await FileSystem.moveAsync({ from: srcItem.path, to: destPath });
                }
            }
            setClipboard({ items: [], action: null });
            readDirectory(currentPath);
        } catch (error) {
            showAlert('Error', error.message || `Failed to ${action} items.`);
        }
    };

    // --- Context Menu Actions ---

    const onContextMenuAction = (action) => {
        const { item } = contextMenu;
        setContextMenu({ visible: false });
        switch (action) {
            case 'share':
                handleFileAction(item, 'share');
                break;
            case 'rename':
                openInputModal('rename', item);
                break;
            case 'delete':
                handleDelete(item);
                break;
            case 'copy':
                handleClipboardAction('copy', [item]);
                break;
            case 'move':
                handleClipboardAction('move', [item]);
                break;
            case 'details':
                showDetails(item);
                break;
        }
    };

    // --- Search Recursive ---

    const recursiveSearch = async (dirPath, query) => {
        let results = [];
        try {
            const contents = await FileSystem.readDirectoryAsync(dirPath);
            for (const name of contents) {
                const itemPath = `${dirPath.replace(/\/?$/, '/')}${name}`;
                const info = await FileSystem.getInfoAsync(itemPath);
                if (info.isDirectory) {
                    if (name.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            name,
                            path: itemPath,
                            isDirectory: true,
                            extension: '',
                            size: info.size || 0,
                            modificationTime: info.modificationTime || 0,
                        });
                    }
                    const nestedResults = await recursiveSearch(itemPath + '/', query);
                    results = results.concat(nestedResults);
                } else {
                    if (name.toLowerCase().includes(query.toLowerCase())) {
                        const extension = name.includes('.') ? name.split('.').pop() : '';
                        results.push({
                            name,
                            path: itemPath,
                            isDirectory: false,
                            extension,
                            size: info.size || 0,
                            modificationTime: info.modificationTime || 0,
                        });
                    }
                }
            }
        } catch {
            // Folder might not have permission or be inaccessible
        }
        return results;
    };

    // --- Live Search Effect ---
    useEffect(() => {
        if (!searchVisible) {
            return;
        }

        const performSearch = async () => {
            if (!searchQuery.trim()) {
                setIsGlobalSearch(false);
                setSearchResults([]);
                return;
            }
            setIsLoading(true);
            const results = await recursiveSearch(APP_STORAGE_ROOT, searchQuery.trim());
            setSearchResults(results);
            setIsGlobalSearch(true);
            setIsLoading(false);
        };

        const debounceTimer = setTimeout(() => {
            performSearch();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery, searchVisible]);

    const onSortChange = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
        setSortMenuVisible(false);
    };

    // --- Alert helper ---

    const showAlert = (title, message, buttons = [{ text: 'OK', onPress: () => setAlertState(prev => ({ ...prev, visible: false })) }]) => {
        setAlertState({ visible: true, title, message, buttons });
    };

    const showToast = (message) => {
        setToast({ visible: true, message });
        setTimeout(() => {
            setToast({ visible: false, message: '' });
        }, 5000);
    };

    // --- Action Handlers ---

    const handleFabAction = async (action) => {
        setIsFabMenuOpen(false);
        switch (action) {
            case 'upload':
                await handleUploadFile();
                break;
            case 'create':
                // Allow folder creation always, also during moving
                openInputModal('create');
                break;
        }
    };

    // --- Settings Persistence ---
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const savedTheme = await AsyncStorage.getItem('theme');
                if (savedTheme !== null) setTheme(savedTheme);
                const biometricSaved = await AsyncStorage.getItem('biometricEnabled');
                if (biometricSaved !== null) setBiometricEnabled(JSON.parse(biometricSaved));
            } catch (e) {
                showAlert('Error', 'Failed to load settings.');
            } finally {
                setSettingsLoaded(true);
            }
        };
        loadSettings();
    }, []);

    // --- Main render ---

    if (!isAuthenticated) {
        return (
            <SafeAreaContextView style={[styles.loader, { backgroundColor: COLORS.background }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ color: COLORS.textSecondary, marginTop: 10 }}>Waiting for authentication...</Text>
            </SafeAreaContextView>
        );
    }

    return (
        <SafeAreaContextView style={[styles.safeArea, { backgroundColor: COLORS.primary }]}>
            <View style={styles.container}>
                <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} backgroundColor={COLORS.primary} />

                {/* HEADER */}
                <View style={styles.header}>
                    {isMultiSelectMode ? (
                        <>
                            <TouchableOpacity onPress={exitMultiSelectMode} style={styles.headerButton}>
                                <Icon name="close" size={24} color={COLORS.headerButton} />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.headerTitle}>{selectedItems.length} selected</Text>
                                <Text style={{ color: COLORS.headerButton, fontSize: 12, margin: -5, marginLeft: 2 }}>{formatBytes(selectedItemsSize)}</Text>
                            </View>
                            <View style={styles.headerRightActions}>
                                <TouchableOpacity onPress={handleShareSelected} style={styles.headerButton}>
                                    <Icon name="share-variant-outline" size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleDeleteSelected} style={styles.headerButton}>
                                    <Icon name="trash-can-outline" size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setHeaderMenuVisible(true)} style={styles.headerButton}>
                                    <Icon name="dots-vertical" size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : searchVisible ? (
                        <View style={styles.headerSearchContainer}>
                            <TextInput
                                style={styles.headerSearchInput}
                                placeholder="Search all files..."
                                placeholderTextColor={COLORS.textSecondary}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                                returnKeyType="search"
                            />
                            <TouchableOpacity onPress={() => { setSearchVisible(false); setSearchQuery(''); setIsGlobalSearch(false); setSearchResults([]); }} style={styles.headerSearchCloseButton}>
                                <Icon name="close" size={22} color={COLORS.headerButton} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                {currentPath === APP_STORAGE_ROOT ? (
                                    <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.headerButton}>
                                        <Icon name="cog-outline" size={24} color={COLORS.headerButton} />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={() => setCurrentPath(currentPath.substring(0, currentPath.slice(0, -1).lastIndexOf('/') + 1))} style={styles.headerButton}>
                                        <Icon name="arrow-left" size={24} color={COLORS.headerButton} />
                                    </TouchableOpacity>
                                )}
                                <Text style={[styles.headerTitle, { marginLeft: 10, flex: 1 }]} numberOfLines={1}>{getCurrentFolderName(currentPath)}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.headerButton}>
                                    <Icon name={'magnify'} size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setViewMode(vm => (vm === 'list' ? 'grid' : 'list'))} style={styles.headerButton}>
                                    <Icon name={viewMode === 'list' ? 'view-grid-outline' : 'view-list-outline'} size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setHeaderMenuVisible(true)} style={styles.headerButton}>
                                    <Icon name="dots-vertical" size={24} color={COLORS.headerButton} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* SEARCH INPUT */}
                {/* This is now handled in the header */}

                {/* FILE LIST */}
                {isLoading && !isRefreshing ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
                ) : (
                    <FlatList
                        key={viewMode + (isGlobalSearch ? '-search' : '')}
                        data={filteredContent}
                        renderItem={({ item }) => (
                            <FileItem
                                item={item}
                                viewMode={viewMode}
                                isSelected={selectedItems.includes(item.path)}
                                isMultiSelectMode={isMultiSelectMode}
                                onPress={() => handleItemPress(item)}
                                onLongPress={(event) => handleItemLongPress(item, event)}
                                onMenuPress={(event) => showContextMenu(item, event)}
                                styles={styles}
                                COLORS={COLORS}
                            />
                        )}
                        keyExtractor={item => item.path}
                        contentContainerStyle={styles.listContentContainer}
                        columnWrapperStyle={viewMode === 'grid' ? styles.columnWrapperStyle : null}
                        numColumns={viewMode === 'grid' ? NUM_COLUMNS : 1}
                        refreshControl={
                            <RefreshControl
                                refreshing={isRefreshing}
                                onRefresh={onRefresh}
                                colors={[COLORS.primary]}
                                tintColor={COLORS.primary}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Icon name="folder-search-outline" size={80} color={COLORS.textSecondary} />
                                <Text style={styles.emptyText}>No items found</Text>
                            </View>
                        }
                    />
                )}

                {/* FLOATING ACTION BUTTON */}
                {!isMultiSelectMode && (
                    <FloatingActionButton
                        isOpen={isFabMenuOpen}
                        onToggle={() => setIsFabMenuOpen(o => !o)}
                        onAction={handleFabAction}
                        styles={styles}
                        COLORS={COLORS}
                        bottomOffset={clipboard.items.length > 0 ? 100 : 35}
                    />
                )}

                {/* PASTE BAR */}
                {clipboard.items.length > 0 && (
                    <View style={styles.pasteBar}>
                        <View style={styles.pasteBarActions}>
                            <TouchableOpacity onPress={() => setClipboard({ items: [], action: null })} style={[styles.pasteButton, { backgroundColor: COLORS.border }]}>
                                <Text style={[styles.modalButtonText, { color: COLORS.modalButtonCancelText }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handlePaste} style={styles.pasteButton}>
                                <Text style={styles.modalButtonText}>{clipboard.action === 'copy' ? 'Copy Here' : 'Move Here'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* SORT MENU */}
                <Modal visible={sortMenuVisible} transparent animationType="fade" onRequestClose={() => setSortMenuVisible(false)}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setSortMenuVisible(false)}>
                        <View style={[styles.contextMenu, { top: 100, right: 10, position: 'absolute' }]}>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onSortChange('name')}>
                                <Icon name="sort-alphabetical-variant" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Sort by Name</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onSortChange('date')}>
                                <Icon name="sort-clock-ascending-outline" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Sort by Date</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onSortChange('size')}>
                                <Icon name="sort-numeric-variant" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Sort by Size</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* INPUT MODAL (Create Folder / Rename) */}
                <Modal visible={inputModal.visible} transparent animationType="fade" onRequestClose={() => setInputModal({ visible: false })}>
                    <Pressable style={[styles.modalBackdrop, { justifyContent: 'center' }]} onPress={() => setInputModal({ visible: false })}>
                        <Pressable style={styles.inputModalContent} onPress={e => e.stopPropagation()}>
                            <Text style={styles.modalTitle}>{inputModal.type === 'create' ? 'Create Folder' : 'Rename Item'}</Text>
                            <TextInput
                                style={styles.input}
                                value={itemName}
                                onChangeText={setItemName}
                                autoFocus
                                onSubmitEditing={handleModalSubmit}
                                placeholder={inputModal.type === 'create' ? 'Folder Name' : 'New Name'}
                                placeholderTextColor={COLORS.textSecondary}
                            />
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={[styles.modalButton, { backgroundColor: COLORS.border }]} onPress={() => { setInputModal({ visible: false }); setItemName(''); }}>
                                    <Text style={[styles.modalButtonText, { color: COLORS.modalButtonCancelText }]}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.modalButton} onPress={handleModalSubmit}>
                                    <Text style={styles.modalButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* CONTEXT MENU */}
                <Modal visible={contextMenu.visible} transparent animationType="fade" onRequestClose={() => setContextMenu({ visible: false })}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setContextMenu({ visible: false })}>
                        <View style={[styles.contextMenu, { top: contextMenu.y, left: contextMenu.x }]}>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('copy')}>
                                <Icon name="content-copy" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Copy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('move')}>
                                <Icon name="folder-move-outline" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Move</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('share')}>
                                <Icon name="share-variant-outline" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Share</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('rename')}>
                                <Icon name="pencil-outline" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Rename</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('details')}>
                                <Icon name="information-outline" size={22} color={COLORS.textPrimary} />
                                <Text style={styles.contextMenuItemText}>Details</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.contextMenuItem} onPress={() => onContextMenuAction('delete')}>
                                <Icon name="trash-can-outline" size={22} color={COLORS.destructive} />
                                <Text style={[styles.contextMenuItemText, { color: COLORS.destructive }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Modal>

                {/* DETAILS MODAL */}
                {detailsItem && (
                    <Modal visible={!!detailsItem} transparent animationType="fade" onRequestClose={() => setDetailsItem(null)}>
                        <Pressable style={[styles.modalBackdrop, { justifyContent: 'center' }]} onPress={() => setDetailsItem(null)}>
                            <Pressable style={styles.detailsModalContent} onPress={e => e.stopPropagation()}>
                                <Text style={styles.modalTitle}>Details</Text>
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>Name</Text>
                                    <Text style={styles.detailsValue} numberOfLines={2}>{detailsItem.name}</Text>
                                </View>
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>Type</Text>
                                    <Text style={styles.detailsValue}>{detailsItem.isDirectory ? 'Folder' : 'File'}</Text>
                                </View>
                                {!detailsItem.isDirectory && (
                                    <View style={styles.detailsRow}>
                                        <Text style={styles.detailsLabel}>Size</Text>
                                        <Text style={styles.detailsValue}>{formatBytes(detailsItem.size)}</Text>
                                    </View>
                                )}
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>Last Modified</Text>
                                    <Text style={styles.detailsValue}>{formatTimestamp(detailsItem.modificationTime)}</Text>
                                </View>
                                <View style={styles.detailsRow}>
                                    <Text style={styles.detailsLabel}>Path</Text>
                                    <Text style={styles.detailsValue} numberOfLines={3}>{detailsItem.path}</Text>
                                </View>
                                {!detailsItem.isDirectory && detailsItem.extension && (
                                    <View style={styles.detailsRow}>
                                        <Text style={styles.detailsLabel}>MIME Type</Text>
                                        <Text style={styles.detailsValue}>{getMimeType(detailsItem.extension)}</Text>
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => setDetailsItem(null)} style={[styles.modalButton, { alignSelf: 'center', marginTop: 20 }]}>
                                    <Text style={styles.modalButtonText}>Close</Text>
                                </TouchableOpacity>
                            </Pressable>
                        </Pressable>
                    </Modal>
                )}


                {/* HEADER CONTEXT MENU */}
                <Modal visible={headerMenuVisible} transparent animationType="fade" onRequestClose={() => setHeaderMenuVisible(false)}>
                    <Pressable style={styles.modalBackdrop} onPress={() => setHeaderMenuVisible(false)}>
                        <View style={[styles.contextMenu, { top: Platform.OS === 'ios' ? 90 : 50, right: 10, position: 'absolute' }]}>
                            {isMultiSelectMode ? (
                                <>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setHeaderMenuVisible(false); exitMultiSelectMode(); }}>
                                        <Icon name="select-off" size={22} color={COLORS.textPrimary} />
                                        <Text style={styles.contextMenuItemText}>Deselect All</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setHeaderMenuVisible(false); handleClipboardAction('copy', (isGlobalSearch ? searchResults : directoryContent).filter(item => selectedItems.includes(item.path))) }}>
                                        <Icon name="content-copy" size={22} color={COLORS.textPrimary} />
                                        <Text style={styles.contextMenuItemText}>Copy</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setHeaderMenuVisible(false); handleClipboardAction('move', (isGlobalSearch ? searchResults : directoryContent).filter(item => selectedItems.includes(item.path))) }}>
                                        <Icon name="folder-move-outline" size={22} color={COLORS.textPrimary} />
                                        <Text style={styles.contextMenuItemText}>Move</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setHeaderMenuVisible(false); handleDeleteSelected(); }}>
                                        <Icon name="trash-can-outline" size={22} color={COLORS.destructive} />
                                        <Text style={[styles.contextMenuItemText, { color: COLORS.destructive }]}>Delete</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={handleSelectAll}>
                                        <Icon name="select-all" size={22} color={COLORS.textPrimary} />
                                        <Text style={styles.contextMenuItemText}>Select All</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.contextMenuItem} onPress={() => { setHeaderMenuVisible(false); setSortMenuVisible(true); }}>
                                        <Icon name="sort" size={22} color={COLORS.textPrimary} />
                                        <Text style={styles.contextMenuItemText}>Sort</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </Pressable>
                </Modal>

                {/* SETTINGS MODAL */}
                <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
                    <Pressable style={[styles.modalBackdrop, { justifyContent: 'center' }]} onPress={() => setSettingsVisible(false)}>
                        <Pressable style={styles.settingsModalContent} onPress={e => e.stopPropagation()}>
                            <View style={styles.settingsHeader}>
                                <Text style={styles.settingsTitle}>Settings</Text>
                                <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.headerButton}>
                                    <Icon name="close" size={24} color={COLORS.textPrimary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.settingRow}>
                                <Icon name="theme-light-dark" size={24} color={COLORS.textSecondary} style={styles.settingIcon} />
                                <View style={styles.settingRowTextContainer}>
                                    <Text style={styles.settingLabel}>Dark Theme</Text>
                                    <Text style={styles.settingDescription}>Enable or disable dark mode.</Text>
                                </View>
                                <Switch
                                    value={theme === 'dark'}
                                    onValueChange={toggleTheme}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={theme === 'dark' ? '#FFFFFF' : '#f4f3f4'}
                                    ios_backgroundColor={COLORS.border}
                                />
                            </View>

                            <View style={styles.settingRow}>
                                <Icon name="fingerprint" size={24} color={COLORS.textSecondary} style={styles.settingIcon} />
                                <View style={styles.settingRowTextContainer}>
                                    <Text style={styles.settingLabel}>Biometric Lock</Text>
                                    <Text style={styles.settingDescription}>Secure the app with your fingerprint.</Text>
                                </View>
                                <Switch
                                    value={biometricEnabled}
                                    onValueChange={toggleBiometrics}
                                    trackColor={{ false: COLORS.border, true: COLORS.accent }}
                                    thumbColor={biometricEnabled ? '#FFFFFF' : (theme === 'dark' ? COLORS.textSecondary : '#f4f3f4')}
                                    ios_backgroundColor={COLORS.border}
                                />
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* CUSTOM ALERT */}
                <CustomAlert
                    visible={alertState.visible}
                    title={alertState.title}
                    message={alertState.message}
                    buttons={alertState.buttons}
                    styles={styles}
                />

                {/* TOAST NOTIFICATION */}
                {toast.visible && (
                    <View style={styles.toastContainer}>
                        <Text style={styles.toastText}>{toast.message}</Text>
                    </View>
                )}
            </View>
        </SafeAreaContextView>
    );
}

// --- STYLES ---
const getStyles = (COLORS, viewMode) => StyleSheet.create({
    safeArea: { flex: 1 },
    container: { flex: 1, backgroundColor: COLORS.background },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: '30%' },
    emptyText: { marginTop: 15, fontSize: 18, color: COLORS.textSecondary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 12 },
    headerTitle: { color: COLORS.headerButton, fontSize: 20, fontWeight: '600', flex: 1, textAlign: 'left' },
    headerButton: { paddingHorizontal: 8, paddingVertical: 5 },
    headerRightActions: { flexDirection: 'row' },
    headerActionContainer: {
        width: 60,
        justifyContent: 'center',
    },
    headerSearchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
    },
    headerSearchInput: {
        flex: 1,
        color: COLORS.headerButton,
        fontSize: 18,
        paddingVertical: 8,
        paddingHorizontal: 15,
    },
    headerSearchCloseButton: {
        padding: 8,
    },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginVertical: 8 },
    searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 16, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: COLORS.surface },
    cancelSearchButton: { marginLeft: 10 },

    listContentContainer: { paddingHorizontal: 10, paddingBottom: 150, paddingTop: 10 },
    columnWrapperStyle: { justifyContent: 'space-between' },
    itemContainerList: {
        flex: 1, flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, padding: 12,
        marginVertical: 4, marginHorizontal: 5,
        borderRadius: 12, elevation: 1,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    itemContainerGrid: {
        width: ITEM_SIZE,
        marginBottom: ITEM_MARGIN,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    itemImage: {
        width: 40,
        height: 40,
        borderRadius: 4,
    },
    itemImageGrid: {
        width: '100%',
        height: 100,
        borderRadius: 8,
        marginBottom: 8,
    },
    itemPressed: { transform: [{ scale: 0.98 }] },
    itemSelected: { backgroundColor: COLORS.border },
    itemName: { fontSize: 16, marginLeft: 16, flex: 1, color: COLORS.textPrimary, fontWeight: '500' },
    itemNameGrid: { textAlign: 'center', marginTop: 8, fontSize: 14, color: COLORS.textPrimary, fontWeight: '500', flexShrink: 1 },
    itemSelectedText: { color: COLORS.textPrimary, fontWeight: 'bold' },
    menuButton: { padding: 8, marginLeft: 8 },
    selectionIcon: {
        marginLeft: 'auto',
        padding: 8,
    },
    selectionIconGrid: {
        position: 'absolute',
        top: 8,
        right: 8,
    },

    fabContainer: { position: 'absolute', bottom: 35, right: 25, alignItems: 'center' },
    fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
    fabSubMenu: { alignItems: 'center', gap: 15, marginBottom: 15 },
    fabSecondary: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', elevation: 6 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'center' },
    contextMenu: { minWidth: '55%', backgroundColor: COLORS.surface, borderRadius: 12, paddingVertical: 8, elevation: 5, position: 'absolute' },
    contextMenuTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.textSecondary, paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    contextMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18 },
    contextMenuItemText: { fontSize: 17, color: COLORS.textPrimary, marginLeft: 18 },

    detailsModalContent: { width: '90%', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, elevation: 10 },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    detailsLabel: { fontSize: 16, color: COLORS.textSecondary, fontWeight: '600', flex: 1 },
    detailsValue: { fontSize: 16, color: COLORS.textPrimary, flex: 2, textAlign: 'right' },

    inputModalContent: { width: '90%', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto', backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, elevation: 10 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, color: COLORS.textPrimary },
    input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBackground, borderRadius: 10, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, marginBottom: 24, color: COLORS.textPrimary },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
    modalButton: { paddingVertical: 12, paddingHorizontal: 22, borderRadius: 10, backgroundColor: COLORS.primary },
    modalButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    pasteBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', elevation: 10 },
    pasteBarActions: { flexDirection: 'row', gap: 10 },
    pasteButton: {
        minWidth: 120,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
    },

    customAlertContainer: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, marginHorizontal: 30, alignItems: 'center', elevation: 10 },
    customAlertTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, color: COLORS.textPrimary, textAlign: 'center' },
    customAlertMessage: { fontSize: 16, marginBottom: 20, color: COLORS.textSecondary, textAlign: 'center' },
    customAlertButtons: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
    customAlertButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, backgroundColor: COLORS.primary, minWidth: 80, alignItems: 'center' },
    customAlertButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    settingsModalContent: {
        width: '90%',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 15,
        alignSelf: 'center',
        elevation: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
    },
    settingsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    settingsTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
    },
    settingIcon: {
        marginRight: 15,
    },
    settingRowTextContainer: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 17,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    settingDescription: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 2,
    },

    toastContainer: {
        position: 'absolute',
        bottom: 100,
        left: '10%',
        right: '10%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderRadius: 25,
        padding: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastText: {
        color: '#fff',
        fontSize: 16,
    },

});
