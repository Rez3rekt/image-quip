import { useState, useEffect } from 'react';
import '../styles/AccountScreen.css'; // Create this CSS file
import { SERVER_BASE_URL } from '../config'; // <<< Add this import
import { LoadingButton } from './common';
import { useToast } from './common'; // Add toast hook

// Consider moving to a shared constants file later
const ALL_POPULAR_ICONS = [
  // Faces & People
  '😀',
  '😃',
  '😄',
  '😁',
  '😆',
  '😅',
  '😂',
  '🤣',
  '😊',
  '😇',
  '🙂',
  '🙃',
  '😉',
  '😌',
  '😍',
  '🥰',
  '😘',
  '😗',
  '😙',
  '😚',
  '😋',
  '😛',
  '😝',
  '😜',
  '🤪',
  '🤨',
  '🧐',
  '🤓',
  '😎',
  '🥸',
  '🤩',
  '🥳',
  '😏',
  '😒',
  '😞',
  '😔',
  '😟',
  '😕',
  '🙁',
  '☹️',
  '😣',
  '😖',
  '😫',
  '😩',
  '🥺',
  '😢',
  '😭',
  '😤',
  '😠',
  '😡',
  '🤬',
  '🤯',
  '😳',
  '🥵',
  '🥶',
  '😱',
  '😨',
  '😰',
  '😥',
  '😓',
  '🤗',
  '🤔',
  '🤭',
  '🤫',
  '🤥',
  '😶',
  '😐',
  '😑',
  '😬',
  '🙄',
  '😯',
  '😦',
  '😧',
  '😮',
  '😲',
  '🥱',
  '😴',
  '🤤',
  '😪',
  '😵',
  '🤐',
  '🥴',
  '🤢',
  '🤮',
  '🤧',
  '😷',
  '🤒',
  '🤕',
  '🤑',
  '🤠',
  '😈',
  '👿',
  '👹',
  '👺',
  '🤡',
  '💩',
  '👻',
  '💀',
  '☠️',
  '👽',
  '👾',
  '🤖',
  '🎃',
  '😺',
  '😸',
  '😹',
  '😻',
  '😼',
  '😽',
  '🙀',
  '😿',
  '😾',
  // Gestures & Body Parts
  '👋',
  '🤚',
  '🖐️',
  '✋',
  '🖖',
  '👌',
  '🤌',
  '🤏',
  '✌️',
  '🤞',
  '🤟',
  '🤘',
  '🤙',
  '👈',
  '👉',
  '👆',
  '🖕',
  '👇',
  '☝️',
  '👍',
  '👎',
  '✊',
  '👊',
  '🤛',
  '🤜',
  '👏',
  '🙌',
  '👐',
  '🤲',
  '🤝',
  '🙏',
  '✍️',
  '💅',
  '🤳',
  '💪',
  '🦾',
  '🦵',
  '🦿',
  '🦶',
  '👂',
  '🦻',
  '👃',
  '🧠',
  '🫀',
  '🫁',
  '🦷',
  '🦴',
  '👀',
  '👁️',
  '👅',
  '👄',
  // Objects
  '👓',
  '🕶️',
  '🥽',
  '🥼',
  '🦺',
  '👔',
  '👕',
  '👖',
  '🧣',
  '🧤',
  '🧥',
  '🧦',
  '👗',
  '👘',
  '🥻',
  '🩱',
  '🩲',
  '🩳',
  '👙',
  '👚',
  '👛',
  '👜',
  '👝',
  '🎒',
  '👞',
  '👟',
  '🥾',
  '🥿',
  '👠',
  '👡',
  '🩰',
  '👢',
  '👑',
  '👒',
  '🎩',
  '🎓',
  '🧢',
  '⛑️',
  '💄',
  '💍',
  '💼',
  // Symbols & Misc
  '❤️',
  '🧡',
  '💛',
  '💚',
  '💙',
  '💜',
  '🖤',
  '🤍',
  '🤎',
  '💔',
  '❣️',
  '💕',
  '💞',
  '💓',
  '💗',
  '💖',
  '💘',
  '💝',
  '💟',
  '☮️',
  '✝️',
  '☪️',
  '🕉️',
  '☸️',
  '✡️',
  '🔯',
  '🕎',
  '☯️',
  '☦️',
  '🛐',
  '⛎',
  '♈',
  '♉',
  '♊',
  '♋',
  '♌',
  '♍',
  '♎',
  '♏',
  '♐',
  '♑',
  '♒',
  '♓',
  '🆔',
  '⚛️',
  '🉑',
  '☢️',
  '☣️',
  '📴',
  '📳',
  '🈶',
  '🈚',
  '🈸',
  '🈺',
  '🈷️',
  '✴️',
  '🆚',
  '💮',
  '🉐',
  '㊙️',
  '㊗️',
  '🈴',
  '🈵',
  '🈹',
  '🈲',
  '🅰️',
  '🅱️',
  '🆎',
  '🆑',
  '🅾️',
  '🆘',
  '❌',
  '⭕',
  '🛑',
  '⛔',
  '📛',
  '🚫',
  '💯',
  '💢',
  '♨️',
  '🚷',
  '🚯',
  '🚳',
  '🚱',
  '🔞',
  '📵',
  '🚭',
  '❗️',
  '❕',
  '❓',
  '❔',
  '‼️',
  '⁉️',
  '🔅',
  '🔆',
  '〽️',
  '⚠️',
  '🚸',
  '🔱',
  '⚜️',
  '🔰',
  '♻️',
  '✅',
  '🈯',
  '💹',
  '❇️',
  '✳️',
  '❎',
  '🌐',
  '💠',
  'Ⓜ️',
  '🌀',
  '💤',
  '🏧',
  '🚾',
  '♿',
  '🅿️',
  '🈳',
  '🈂️',
  '🛂',
  '🛃',
  '🛄',
  '🛅',
  '🚹',
  '🚺',
  '🚼',
  '🚻',
  '🚮',
  '🎦',
  '📶',
  '🈁',
  '🔣',
  'ℹ️',
  '🔤',
  '🔡',
  '🔠',
  '🆖',
  '🆗',
  '🆙',
  '🆒',
  '🆕',
  '🆓',
  '0️⃣',
  '1️⃣',
  '2️⃣',
  '3️⃣',
  '4️⃣',
  '5️⃣',
  '6️⃣',
  '7️⃣',
  '8️⃣',
  '9️⃣',
  '🔟',
  '🔢',
  '#️⃣',
  '*️⃣',
  '⏏️',
  '▶️',
  '⏸️',
  '⏯️',
  '⏹️',
  '⏺️',
  '⏭️',
  '⏮️',
  '⏩',
  '⏪',
  '⏫',
  '⏬',
  '◀️',
  '🔼',
  '🔽',
  '➡️',
  '⬅️',
  '⬆️',
  '⬇️',
  '↗️',
  '↘️',
  '↙️',
  '↖️',
  '↕️',
  '↔️',
  '↪️',
  '↩️',
  '⤴️',
  '⤵️',
  '🔀',
  '🔁',
  '🔂',
  '🔄',
  '🔃',
  '🎵',
  '🎶',
  '➕',
  '➖',
  '➗',
  '✖️',
  '♾️',
  '💲',
  '💱',
  '™️',
  '©️',
  '®️',
  '〰️',
  '➰',
  '➿',
  '🔚',
  '🔙',
  '🔛',
  '🔝',
  '🔜',
  '✔️',
  '☑️',
  '🔘',
  '🔴',
  '🟠',
  '🟡',
  '🟢',
  '🔵',
  '🟣',
  '⚫',
  '⚪',
  '🟤',
  '🔺',
  '🔻',
  '⬜',
  '⬛',
  '◼️',
  '◻️',
  '◾',
  '◽',
  '▪️',
  '▫️',
  '🔶',
  '🔷',
  '🔸',
  '🔹',
  '▲',
  '▼',
  '♦️',
  '🔳',
  '🔲',
  '🏁',
  '🚩',
  '🎌',
  '🏴',
  '🏳️',
  '🏳️‍🌈',
  '🏳️‍⚧️',
  '🏴‍☠️',
  // Food & Drink
  '🍏',
  '🍎',
  '🍐',
  '🍊',
  '🍋',
  '🍌',
  '🍉',
  '🍇',
  '🍓',
  '🍈',
  '🍒',
  '🍑',
  '🥭',
  '🍍',
  '🥥',
  '🥝',
  '🍅',
  '🍆',
  '🥑',
  '🥦',
  '🥬',
  '🥒',
  '🌶️',
  '🌽',
  '🥕',
  '🧄',
  '🧅',
  '🥔',
  '🍠',
  '🥐',
  '🥯',
  '🍞',
  '🥖',
  '🥨',
  '🧀',
  '🥚',
  '🍳',
  '🧈',
  '🥞',
  '🧇',
  '🥓',
  '🥩',
  '🍗',
  '🍖',
  /*'🦴',*/ '🌭',
  '🍔',
  '🍟',
  '🍕',
  '🥪',
  '🥙',
  '🌮',
  '🌯',
  '🥗',
  '8',
  '🥫',
  '🍝',
  '🍜',
  '🍲',
  '🍛',
  '🍣',
  '🍱',
  '🥟',
  '🍤',
  '🍙',
  '🍚',
  '🍘',
  '🍥',
  '🥠',
  '🥮',
  '🍢',
  '🍡',
  '🍧',
  '🍨',
  '🍦',
  '🥧',
  '🧁',
  '🍰',
  '🎂',
  '🍮',
  '🍭',
  '🍬',
  '🍫',
  '🍿',
  '🍩',
  '🍪',
  '🌰',
  '🥜',
  '🍯',
  '🥛',
  '🍼',
  '☕',
  '🍵',
  '🧃',
  '🥤',
  '🍶',
  '🍺',
  '🍻',
  '🥂',
  '🍷',
  '🥃',
  '🍸',
  '🍹',
  '🧉',
  '🧊',
  '🥢',
  '🍽️',
  '🍴',
  '🥄',
  // Activities & Sports
  '⚽',
  '🏀',
  '🏈',
  '⚾',
  '🥎',
  '🎾',
  '🏐',
  '🏉',
  '🎱',
  '🏓',
  '🏸',
  '🏒',
  '🏑',
  '🥍',
  '🏏',
  '🥅',
  '⛳',
  '🏹',
  '🎣',
  '🥊',
  '🥋',
  '🎽',
  '🛹',
  '🛷',
  '⛸️',
  '🥌',
  '🎿',
  '⛷️',
  '🏂',
  '🏋️‍♀️',
  '🏋️‍♂️',
  '🤺',
  '🤸‍♀️',
  '🤸‍♂️',
  '⛹️‍♀️',
  '⛹️‍♂️',
  '🤾‍♀️',
  '🤾‍♂️',
  '🧗‍♀️',
  '🧗‍♂️',
  '🏌️‍♀️',
  '🏌️‍♂️',
  '🧘‍♀️',
  '🧘‍♂️',
  '🏄‍♀️',
  '🏄‍♂️',
  '🏊‍♀️',
  '🏊‍♂️',
  '🤽‍♀️',
  '🤽‍♂️',
  '🚣‍♀️',
  '🚣‍♂️',
  '🏇',
  '🚴‍♀️',
  '🚴‍♂️',
  '🚵‍♀️',
  '🚵‍♂️',
  '🏅',
  '🎖️',
  '🥇',
  '🥈',
  '🥉',
  '🏆',
  '🏵️',
  '🎗️',
  '🎫',
  '🎟️',
  '🎪',
  '🤹‍♀️',
  '🤹‍♂️',
  '🎭',
  '🎨',
  '🎬',
  '🎤',
  '🎧',
  '🎼',
  '🎹',
  '🥁',
  '🎷',
  '🎺',
  '🎸',
  '🎻',
  '🎲',
  '♟️',
  '🎯',
  '🎳',
  '🎮',
  '🎰',
  '🧩',
  // Travel & Places
  '🚗',
  '🚕',
  '🚙',
  '🚌',
  '🚎',
  '🏎️',
  '🚓',
  '🚑',
  '🚒',
  '🚐',
  '🚚',
  '🚛',
  '🚜',
  '🛴',
  '🚲',
  '🛵',
  '🏍️',
  '🚨',
  '🚔',
  '🚍',
  '🚘',
  '🚖',
  '🚃',
  '🚋',
  '🚞',
  '🚝',
  '🚄',
  '🚅',
  '🚈',
  '🚂',
  '🚆',
  '🚇',
  '🚊',
  '🚉',
  '✈️',
  '🛫',
  '🛬',
  '💺',
  '🚀',
  '🛸',
  '🚁',
  '🛶',
  '⛵',
  '🚤',
  '🛥️',
  '🛳️',
  '⛴️',
  '⚓',
  '⛽',
  '🚧',
  '🚦',
  '🚥',
  '🗺️',
  '🗿',
  '🗽',
  '🗼',
  '🏰',
  '🏯',
  '🏟️',
  '🎡',
  '🎢',
  '🎠',
  '⛲',
  '⛱️',
  '🏖️',
  '🏝️',
  '🏜️',
  '🌋',
  '⛰️',
  '🏔️',
  '🗻',
  '🏕️',
  '⛺',
  '🏠',
  '🏡',
  '🏘️',
  '🏚️',
  '🏗️',
  '🏭',
  '🏢',
  '🏬',
  '🏣',
  '🏤',
  '🏥',
  '🏦',
  '🏨',
  '🏪',
  '🏫',
  '🏩',
  '💒',
  '🏛️',
  '⛪',
  '🕌',
  '🕍',
  '⛩️',
  '🕋',
  /*'♨️',*/ '🌌',
  '🌠',
  '🎇',
  '🎆',
  '🌇',
  '🌆',
  '🏙️',
  '🌃',
  '🌉',
  /*'🎠', '🎭', '🖼️', '🎨',*/ '🛒',
  // Animals & Nature
  '🐶',
  '🐱',
  '🐭',
  '🐹',
  '🐰',
  '🦊',
  '🐻',
  '🐼',
  '🐨',
  '🐯',
  '🦁',
  '🐮',
  '🐷',
  '🐽',
  '🐸',
  '🐵',
  '🙈',
  '🙉',
  '🙊',
  '🐒',
  '🐔',
  '🐧',
  '🐦',
  '🐤',
  '🐣',
  '🐥',
  '🦆',
  '🦅',
  '🦉',
  '🦇',
  '🐺',
  '🐗',
  '🐴',
  '🦄',
  '🐝',
  '🐛',
  '🦋',
  '🐌',
  '🐞',
  '🐜',
  '🦗',
  '🕷️',
  '🕸️',
  '🦂',
  '🦟',
  '🦠',
  '🐢',
  '🐍',
  '🦎',
  '🦖',
  '🦕',
  '🐙',
  '🦑',
  '🦐',
  '🦞',
  '🦀',
  '🐡',
  '🐠',
  '🐟',
  '🐬',
  '🐳',
  '🐋',
  '🦈',
  '🐊',
  '🐅',
  '🐆',
  '🦓',
  '🦍',
  '🦧',
  '🐘',
  '🦛',
  '🦏',
  '🐪',
  '🐫',
  '🦒',
  '🦘',
  '🐃',
  '🐂',
  '🐄',
  '🐎',
  '🐖',
  '🐏',
  '🐑',
  '🦙',
  '🐐',
  '🦌',
  '🐕',
  '🐩',
  '🦮',
  '🐕‍🦺',
  '🐈',
  '🐓',
  '🦃',
  '🦚',
  '🦜',
  '🦢',
  '🕊️',
  '🐇',
  '🦝',
  '🦨',
  '🦦',
  '🦥',
  '🐁',
  '🐀',
  '🐿️',
  '🦔',
  '🐾',
  '🐉',
  '🐲',
  '🌵',
  '🎄',
  '🌲',
  '🌳',
  '🌴',
  '🌱',
  '🌿',
  '☘️',
  '🍀',
  '🎍',
  '🎋',
  '🍃',
  '🍂',
  '🍁',
  '🍄',
  '🐚',
  '🌾',
  '💐',
  '🌷',
  '🌹',
  '🥀',
  '🌺',
  '🌸',
  '🌼',
  '🌻',
  '🌞',
  '🌝',
  '🌛',
  '🌜',
  '🌑',
  '🌒',
  '🌓',
  '🌔',
  '🌕',
  '🌖',
  '🌗',
  '🌘',
  '🌙',
  '🌚',
  /*'🌛', '🌜',*/ '⭐',
  '🌟',
  '💫',
  '✨',
  '☄️',
  '☀️',
  '🌤️',
  '⛅',
  '🌥️',
  '🌦️',
  '☁️',
  '🌧️',
  '⛈️',
  '🌩️',
  '⚡',
  '🔥',
  '💥',
  '❄️',
  '🌨️',
  '☃️',
  '⛄',
  '🌬️',
  '💨',
  '💧',
  '💦',
  '☔',
  '☂️',
  '🌊',
  '🌫️',
];

// Placeholder for recently used - replace with actual fetched data
const PLACEHOLDER_RECENT_ICONS = [
  '👍',
  '🎉',
  '🤔',
  '🍕',
  '🚀',
  '💡',
  '🎲',
  '🤖',
  '👻',
  '👑',
  '👽',
  '⭐',
];

function AccountScreen({ currentUsername, onSaveChanges, onLogout, onNavigateBack }) {
  const [nickname, setNickname] = useState(currentUsername || '');
  const [selectedIcon, setSelectedIcon] = useState('👤'); // Default/initial
  const [recentlyUsedIcons, setRecentlyUsedIcons] = useState(PLACEHOLDER_RECENT_ICONS); // Placeholder
  const [showAllIcons, setShowAllIcons] = useState(false); // Control visibility
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { showSuccess, showError, showWarning: _showWarning } = useToast(); // Add toast hooks

  // Placeholder effect to fetch user preferences (including actual recent icons)
  useEffect(() => {
    setIsLoading(true);
    console.log('AccountScreen mounted. Fetching user preferences...');

    const fetchUserPreferences = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('No token found, cannot fetch preferences.');
        setError('You must be logged in to view account settings.');
        setIsLoading(false);
        return;
      }

      try {
        // <<< Actual API call >>>
        const response = await fetch(`${SERVER_BASE_URL}/api/account/prefs`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('token'); // Clear expired/invalid token
          setError('Session expired. Please log in again.');
          onLogout(); // Force logout
          setIsLoading(false);
          return;
        }
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to fetch preferences: ${response.statusText}`,
          );
        }

        const prefs = await response.json();
        console.log('Fetched Prefs:', prefs);

        // <<< Ensure both nickname and icon are set from prefs >>>
        setNickname(prefs.defaultNickname || currentUsername || '');
        setSelectedIcon(prefs.defaultIcon || '👤'); // Set icon from fetched prefs

        // Set recently used icons (needs implementation on backend)
        // setRecentlyUsedIcons(prefs.recentIcons || PLACEHOLDER_RECENT_ICONS);
        setError('');
      } catch (fetchError) {
        console.error('Error fetching preferences:', fetchError);
        setError('Could not load your preferences.');
        // Fallback or keep defaults
        setNickname(currentUsername || '');
        setSelectedIcon('👤');
        // setRecentlyUsedIcons(PLACEHOLDER_RECENT_ICONS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPreferences();
  }, [currentUsername, onLogout]); // Add onLogout dependency

  const handleSave = async e => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required to save.');
      setIsLoading(false);
      return;
    }

    const preferences = { defaultNickname: nickname, defaultIcon: selectedIcon };
    console.log('Attempting to save preferences:', preferences);
    try {
      // <<< Actual Save API Call >>>
      const response = await fetch(`${SERVER_BASE_URL}/api/account/prefs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(preferences),
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
        onLogout();
        setIsLoading(false);
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to save preferences: ${response.statusText}`);
      }

      const data = await response.json(); // Assuming success message/data is returned
      if (data.success) {
        setSuccessMessage('Preferences saved successfully!');
        showSuccess('Your preferences have been saved!', 3000); // Show success toast
        onSaveChanges(preferences); // Notify App
      } else {
        throw new Error(data.message || 'Server reported save failure.');
      }

      // Update recent icons (client-side only for now)
      setRecentlyUsedIcons(prev => {
        const newRecent = [selectedIcon, ...prev.filter(icon => icon !== selectedIcon)];
        return newRecent.slice(0, 12);
      });
    } catch (err) {
      console.error('Save preferences error:', err);
      const errorMsg = err.message || 'Failed to save preferences.';
      setError(errorMsg);
      showError(errorMsg, 5000); // Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  const renderIconButton = icon => (
    <button
      type='button'
      key={icon}
      className={`icon-button ${selectedIcon === icon ? 'selected' : ''}`}
      onClick={() => {
        setSelectedIcon(icon);
        // Maybe close the full list when an icon is selected?
        // setShowAllIcons(false);
      }}
      disabled={isLoading}
      title={icon} // Add tooltip for accessibility/clarity
    >
      {icon}
    </button>
  );

  // <<< Derive the list to display for Recently Used >>>
  const displayedRecentIcons = [
    selectedIcon, // Always show the currently selected icon first
    ...recentlyUsedIcons.filter(icon => icon !== selectedIcon), // Add others, filtering out the current one
  ].slice(0, 12); // Limit to the first 12

  return (
    <div className='account-container card'>
      <h2>Account Management</h2>
      {isLoading && <p>Loading preferences...</p>}
      <form onSubmit={handleSave} className='account-form'>
        <div className='form-group'>
          <label htmlFor='nickname'>Default Nickname:</label>
          <input
            type='text'
            id='nickname'
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder='Nickname used when joining games'
            maxLength={12}
            disabled={isLoading}
          />
        </div>

        {/* --- Icon Selection Refactor --- */}
        <div className='form-group'>
          <div className='icon-label-container'>
            <label>Default Icon:</label>
            <span className='current-icon-display'>{selectedIcon}</span>
          </div>

          {/* Recently Used Section */}
          <div className='icon-section recently-used-icons'>
            <p className='icon-section-title'>Recently Used:</p>
            <div className='icon-grid'>
              {/* <<< Use derived list for rendering >>> */}
              {displayedRecentIcons.length > 0 ? (
                displayedRecentIcons.map(renderIconButton)
              ) : (
                <span className='no-icons-message'>No recent icons yet.</span>
              )}
            </div>
          </div>

          {/* Show More Button & Full List */}
          {!showAllIcons ? (
            <button
              type='button'
              onClick={() => setShowAllIcons(true)}
              className='show-more-icons-button'
              disabled={isLoading}
            >
              Show More Icons...
            </button>
          ) : (
            <div className='icon-section all-icons'>
              <p className='icon-section-title'>All Icons:</p>
              <div className='icon-grid large-grid'>{ALL_POPULAR_ICONS.map(renderIconButton)}</div>
              <button
                type='button'
                onClick={() => setShowAllIcons(false)}
                className='show-less-icons-button'
                disabled={isLoading}
              >
                Show Less
              </button>
            </div>
          )}
        </div>
        {/* --- End Icon Selection Refactor --- */}

        {error && <p className='error-message'>{error}</p>}
        {successMessage && <p className='success-message'>{successMessage}</p>}

        <div className='form-actions'>
          <LoadingButton
            type='submit'
            className='save-button'
            disabled={!nickname.trim()}
            isLoading={isLoading}
            loadingText='Saving...'
            variant='primary'
          >
            Save Preferences
          </LoadingButton>
          <button type='button' onClick={onLogout} className='logout-button' disabled={isLoading}>
            Logout
          </button>
        </div>
      </form>
      <button
        onClick={onNavigateBack}
        className='back-button close-account-button'
        disabled={isLoading}
      >
        Close
      </button>
    </div>
  );
}

export default AccountScreen;
