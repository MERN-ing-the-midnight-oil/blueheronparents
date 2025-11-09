import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Modal,
    Alert,
    ScrollView,
    Platform,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs, where, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import { sendNotificationToUsers } from '../utils/notifications';

interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    endTime?: string;
    description: string;
    location: string;
    createdBy: string;
    createdByEmail: string;
    createdByDisplayName?: string;
    createdByProfileImageUrl?: string;
    seedKey?: string;
}

export default function CalendarScreen() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isFormExpanded, setIsFormExpanded] = useState(false);
    const [seedAttempted, setSeedAttempted] = useState(false);
    const scrollViewRef = useRef<ScrollView | null>(null);
    const dateAnchorRef = useRef<Record<string, number>>({});

    const [newEvent, setNewEvent] = useState({
        title: '',
        date: new Date(),
        time: new Date(),
        description: '',
        location: '',
    });

    const isEmailVerified = auth.currentUser?.emailVerified ?? false;

    const PARK_PLAY_SEED_KEY = 'park_play_dates_2025_2026';
    const PARK_PLAY_EVENTS = [
        {
            title: 'Park Play Date',
            location: 'Elizabeth Park Playground',
            start: new Date('2025-10-11T10:00:00'),
            end: new Date('2025-10-11T12:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Lake Padden Playground',
            start: new Date('2025-11-07T13:00:00'),
            end: new Date('2025-11-07T15:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Cornwall Park Playground',
            start: new Date('2025-12-06T10:00:00'),
            end: new Date('2025-12-06T12:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Squalicum Creek Park',
            start: new Date('2026-01-16T13:00:00'),
            end: new Date('2026-01-16T15:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Whatcom Falls Upper Playground',
            start: new Date('2026-02-22T10:00:00'),
            end: new Date('2026-02-22T12:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Zuanich Point Park',
            start: new Date('2026-03-21T10:00:00'),
            end: new Date('2026-03-21T12:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Cordata Park',
            start: new Date('2026-04-17T13:00:00'),
            end: new Date('2026-04-17T15:00:00'),
        },
        {
            title: 'Park Play Date',
            location: 'Boulevard Park Playground',
            start: new Date('2026-05-09T10:00:00'),
            end: new Date('2026-05-09T12:00:00'),
        },
    ];

    const loadCreatorProfile = useCallback(
        async (userId: string, fallbackEmail: string) => {
            const fallbackDisplayName =
                auth.currentUser?.displayName ||
                (fallbackEmail ? fallbackEmail.split('@')[0] : '') ||
                'Community Member';

            try {
                if (!userId) {
                    return {
                        displayName: fallbackDisplayName,
                        profileImageUrl: undefined,
                    };
                }

                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    const data = userDoc.data() as any;
                    return {
                        displayName: String(data.displayName || fallbackDisplayName),
                        profileImageUrl: data.profileImageUrl ? String(data.profileImageUrl) : undefined,
                    };
                }
            } catch (error) {
                console.warn('[Calendar] Failed to load user profile', error);
            }

            return {
                displayName: fallbackDisplayName,
                profileImageUrl: undefined,
            };
        },
        []
    );

    const seedParkPlayDates = useCallback(async () => {
        if (seedAttempted) return;
        const user = auth.currentUser;
        if (!user) return;

        try {
            const seedQuery = query(collection(db, 'events'), where('seedKey', '==', PARK_PLAY_SEED_KEY));
            const existingSeedDocs = await getDocs(seedQuery);
            if (!existingSeedDocs.empty) {
                setSeedAttempted(true);
                return;
            }

            const creatorProfile = await loadCreatorProfile(user.uid, user.email || '');

            for (const event of PARK_PLAY_EVENTS) {
                const date = event.start.toISOString().split('T')[0];
                const time = event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const endTime = event.end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                const description = `Park Play Date at ${event.location}. Lasts from ${time} to ${endTime}.`;

                await addDoc(collection(db, 'events'), {
                    title: event.title,
                    date,
                    time,
                    endTime,
                    description,
                    location: event.location,
                    createdBy: user.uid,
                    createdByEmail: user.email || '',
                    createdByDisplayName: creatorProfile.displayName,
                    createdByProfileImageUrl: creatorProfile.profileImageUrl || null,
                    seedKey: PARK_PLAY_SEED_KEY,
                    durationMinutes: 120,
                });
            }
        } catch (error) {
            console.warn('Failed to seed park play dates:', error);
        } finally {
            setSeedAttempted(true);
        }
    }, [seedAttempted]);

    useEffect(() => {
        console.log('[Calendar] Current timestamp:', new Date().toISOString());
        const q = query(collection(db, 'events'), orderBy('date', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData: CalendarEvent[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();

                const eventRecord: CalendarEvent = {
                    id: docSnap.id,
                    title: String(data.title || ''),
                    date: String(data.date || ''),
                    time: String(data.time || ''),
                    endTime: data.endTime ? String(data.endTime) : undefined,
                    description: String(data.description || ''),
                    location: String(data.location || ''),
                    createdBy: String(data.createdBy || ''),
                    createdByEmail: String(data.createdByEmail || ''),
                    createdByDisplayName: data.createdByDisplayName
                        ? String(data.createdByDisplayName)
                        : undefined,
                    createdByProfileImageUrl: data.createdByProfileImageUrl
                        ? String(data.createdByProfileImageUrl)
                        : undefined,
                    seedKey: data.seedKey ? String(data.seedKey) : undefined,
                };

                const isPast = isDateInPast(eventRecord.date);
                const isFuture = isDateTodayOrFuture(eventRecord.date);
                console.log('[Calendar] Event hydration:', {
                    title: eventRecord.title,
                    date: eventRecord.date,
                    time: eventRecord.time,
                    status: isPast ? 'Past' : 'Today/Future',
                });

                eventsData.push(eventRecord);
            });

            setEvents(eventsData);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!seedAttempted) {
            seedParkPlayDates();
        }
    }, [seedAttempted, seedParkPlayDates]);

    const isEventOwner = (event: CalendarEvent): boolean => {
        const user = auth.currentUser;
        if (!user) return false;

        const userEmail = user.email?.toLowerCase().trim();
        const eventEmail = event.createdByEmail?.toLowerCase().trim();

        return event.createdBy === user.uid || Boolean(userEmail && eventEmail && userEmail === eventEmail);
    };

    const formatDate = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    const formatTime = (date: Date): string => {
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const toDateOnly = (dateStr: string): Date | null => {
        if (!dateStr) return null;
        const parsed = new Date(`${dateStr}T00:00:00`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const isDateInPast = (dateStr: string): boolean => {
        const eventDate = toDateOnly(dateStr);
        if (!eventDate) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return eventDate.getTime() < today.getTime();
    };

    const isDateTodayOrFuture = (dateStr: string): boolean => {
        const eventDate = toDateOnly(dateStr);
        if (!eventDate) return false;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return eventDate.getTime() >= today.getTime();
    };

    const getCreatorInfo = (event: CalendarEvent) => {
        const displayName =
            event.createdByDisplayName?.trim() ||
            event.createdByEmail?.split('@')[0] ||
            'Community Member';
        const email = event.createdByEmail;
        const profileImageUrl = event.createdByProfileImageUrl || undefined;
        return { displayName, email, profileImageUrl };
    };

    const getInitials = (name?: string, email?: string) => {
        const source = name && name.trim() ? name.trim() : email?.split('@')[0] || '';
        if (!source) return 'M';
        const parts = source.split(' ').filter(Boolean);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    };

    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setNewEvent({ ...newEvent, date: selectedDate });
        }
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) {
            setNewEvent({ ...newEvent, time: selectedTime });
        }
    };

    const handleCreateEvent = async () => {
        if (!isEmailVerified) {
            Alert.alert('Email Not Verified', 'Please verify your email before creating events.');
            return;
        }

        if (!newEvent.title.trim()) {
            Alert.alert('Missing Information', 'Please enter an event title');
            return;
        }

        try {
            const eventDate = formatDate(newEvent.date);
            const eventTime = formatTime(newEvent.time);
            const creatorProfile = await loadCreatorProfile(
                auth.currentUser?.uid || '',
                auth.currentUser?.email || ''
            );

            await addDoc(collection(db, 'events'), {
                title: newEvent.title,
                date: eventDate,
                time: eventTime,
                description: newEvent.description,
                location: newEvent.location,
                createdBy: auth.currentUser?.uid || '',
                createdByEmail: auth.currentUser?.email || '',
                createdByDisplayName: creatorProfile.displayName,
                createdByProfileImageUrl: creatorProfile.profileImageUrl || null,
            });

            // Send notifications to all other users
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const userIds = usersSnapshot.docs
                .map(doc => doc.id)
                .filter(id => id !== auth.currentUser?.uid);

            const formattedDate = new Date(newEvent.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
            });

            const notificationBody = newEvent.location
                ? `${formattedDate} at ${eventTime} • ${newEvent.location}`
                : `${formattedDate} at ${eventTime}`;

            await sendNotificationToUsers(
                userIds,
                `New Event: ${newEvent.title}`,
                notificationBody,
                'calendar'
            );

            setNewEvent({
                title: '',
                date: new Date(),
                time: new Date(),
                description: '',
                location: '',
            });

            setIsFormExpanded(false);
            Alert.alert('Success', 'Event created successfully!');
        } catch (error) {
            console.error('Error creating event:', error);
            Alert.alert('Error', 'Failed to create event');
        }
    };

    const handleDeleteEvent = async (event: CalendarEvent) => {
        Alert.alert(
            'Delete Event',
            `Are you sure you want to delete "${event.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'events', event.id));
                            if (selectedEvent?.id === event.id) {
                                setIsModalVisible(false);
                                setSelectedEvent(null);
                            }
                        } catch (error) {
                            console.error('[Calendar] Delete failed:', error);
                            Alert.alert('Error', 'Failed to delete event');
                        }
                    },
                },
            ]
        );
    };

    // Group events by date
    const groupedEvents = events.reduce((groups, event) => {
        const date = event.date;
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(event);
        return groups;
    }, {} as Record<string, CalendarEvent[]>);

    const sortedDates = Object.keys(groupedEvents).sort();
    const firstFutureDateIndex = sortedDates.findIndex((date) => isDateTodayOrFuture(date));
    const lastPastDateIndex =
        firstFutureDateIndex === -1 ? sortedDates.length - 1 : firstFutureDateIndex - 1;

    useEffect(() => {
        dateAnchorRef.current = {};
    }, [sortedDates.join(',')]);

    useEffect(() => {
        if (!scrollViewRef.current) return;
        if (sortedDates.length === 0) return;

        const targetIndex =
            firstFutureDateIndex === -1 ? sortedDates.length - 1 : firstFutureDateIndex;
        const targetDate = sortedDates[targetIndex];

        let attempts = 0;
        const timeouts: ReturnType<typeof setTimeout>[] = [];

        const attemptScroll = () => {
            const anchorY = dateAnchorRef.current[targetDate];
            if (anchorY !== undefined || attempts >= 5) {
                const offset = anchorY !== undefined ? Math.max(anchorY - 20, 0) : 0;
                scrollViewRef.current?.scrollTo({ y: offset, animated: true });
            } else {
                attempts += 1;
                timeouts.push(setTimeout(attemptScroll, 120));
            }
        };

        timeouts.push(setTimeout(attemptScroll, 150));

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, [sortedDates.join(','), firstFutureDateIndex]);

    return (
        <View style={styles.container}>
            {!isEmailVerified && <EmailVerificationBanner />}

            <ScrollView
                style={styles.scrollView}
                ref={scrollViewRef}
            >
                <View style={styles.createEventSection}>
                    <Pressable
                        style={styles.formHeader}
                        onPress={() => setIsFormExpanded(!isFormExpanded)}
                    >
                        <View style={styles.createButtonRow}>
                            <View style={styles.createButtonContent}>
                                <Text style={styles.createButtonEmoji}>➕</Text>
                                <Text style={styles.createHeaderText}>Create New Event</Text>
                            </View>
                            <Ionicons
                                name={isFormExpanded ? "chevron-up" : "chevron-down"}
                                size={24}
                                color="#2c5f7c"
                            />
                        </View>
                    </Pressable>

                    {isFormExpanded && (
                        <View style={styles.formContent}>
                            <TextInput
                                style={styles.input}
                                placeholder="Event Title *"
                                value={newEvent.title}
                                onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
                            />

                            <Pressable
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <Ionicons name="calendar-outline" size={20} color="#2196F3" />
                                <Text style={styles.dateButtonText}>
                                    {formatDate(newEvent.date)}
                                </Text>
                            </Pressable>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={newEvent.date}
                                    mode="date"
                                    display="default"
                                    onChange={handleDateChange}
                                    minimumDate={new Date()}
                                />
                            )}

                            <Pressable
                                style={styles.dateButton}
                                onPress={() => setShowTimePicker(true)}
                            >
                                <Ionicons name="time-outline" size={20} color="#2196F3" />
                                <Text style={styles.dateButtonText}>
                                    {formatTime(newEvent.time)}
                                </Text>
                            </Pressable>

                            {showTimePicker && (
                                <DateTimePicker
                                    value={newEvent.time}
                                    mode="time"
                                    display="default"
                                    onChange={handleTimeChange}
                                />
                            )}

                            <TextInput
                                style={styles.input}
                                placeholder="Location"
                                value={newEvent.location}
                                onChangeText={(text) => setNewEvent({ ...newEvent, location: text })}
                            />

                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Description"
                                value={newEvent.description}
                                onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                                multiline
                                numberOfLines={4}
                            />

                            <Pressable style={styles.createButton} onPress={handleCreateEvent}>
                                <Text style={styles.createButtonText}>Create Event</Text>
                            </Pressable>
                        </View>
                    )}
                </View>

                <View style={styles.eventsSection}>
                    {sortedDates.length === 0 ? (
                        <Text style={styles.noEvents}>No upcoming events</Text>
                    ) : (
                        sortedDates.map((date, index) => {
                            const eventsForDate = groupedEvents[date];
                            const isPastDate = isDateInPast(date);

                            return (
                                <View key={date}>
                                    <View
                                        style={styles.dateGroup}
                                        onLayout={(event) => {
                                            dateAnchorRef.current[date] = event.nativeEvent.layout.y;
                                        }}
                                    >
                                        <Text
                                            style={[
                                                styles.dateGroupHeader,
                                                isPastDate && styles.pastEventText,
                                            ]}
                                        >
                                    {new Date(date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                                day: 'numeric',
                                    })}
                                </Text>
                                        {eventsForDate.map((event) => {
                                    const owner = isEventOwner(event);
                                            const muteEvent = isPastDate;
                                            const creatorInfo = getCreatorInfo(event);
                                            const initials = getInitials(
                                                creatorInfo.displayName,
                                                creatorInfo.email
                                            );

                                    return (
                                        <Pressable
                                            key={event.id}
                                                    style={[
                                                        styles.eventCard,
                                                        muteEvent && styles.pastEventCard,
                                                    ]}
                                            onPress={() => {
                                                setSelectedEvent(event);
                                                setIsModalVisible(true);
                                            }}
                                        >
                                            <View style={styles.eventHeader}>
                                                <View>
                                                            <Text
                                                                style={[
                                                                    styles.eventTime,
                                                                    muteEvent && styles.pastEventText,
                                                                ]}
                                                            >
                                                                {event.time}
                                                                {event.endTime
                                                                    ? ` – ${event.endTime}`
                                                                    : ''}
                                                            </Text>
                                                </View>
                                                {owner && (
                                                    <Pressable
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteEvent(event);
                                                        }}
                                                        style={styles.headerActionsRow}
                                                    >
                                                                <Ionicons
                                                                    name="trash-outline"
                                                                    size={20}
                                                                    color={muteEvent ? '#7a7a7a' : '#666'}
                                                                />
                                                    </Pressable>
                                                )}
                                            </View>
                                                    <Text
                                                        style={[
                                                            styles.eventTitle,
                                                            muteEvent && styles.pastEventText,
                                                        ]}
                                                    >
                                                        {event.title}
                                                    </Text>
                                                    {event.location !== '' && (
                                                        <Text
                                                            style={[
                                                                styles.eventLocation,
                                                                muteEvent && styles.pastEventText,
                                                            ]}
                                                        >
                                                            📍 {event.location}
                                                        </Text>
                                                    )}
                                                    {event.description !== '' && (
                                                        <Text
                                                            style={[
                                                                styles.eventDescription,
                                                                muteEvent && styles.pastEventText,
                                                            ]}
                                                        >
                                                            {event.description}
                                                        </Text>
                                                    )}
                                                    <View style={styles.eventCreatorRow}>
                                                        {creatorInfo.profileImageUrl ? (
                                                            <Image
                                                                source={{ uri: creatorInfo.profileImageUrl }}
                                                                style={styles.eventCreatorAvatar}
                                                            />
                                                        ) : (
                                                            <View style={styles.eventCreatorPlaceholder}>
                                                                <Text style={styles.eventCreatorInitials}>
                                                                    {initials}
                                                                </Text>
                                                            </View>
                                                        )}
                                                        <View>
                                                            <Text
                                                                style={[
                                                                    styles.eventCreatorName,
                                                                    muteEvent && styles.pastEventText,
                                                                ]}
                                                            >
                                                                {creatorInfo.displayName}
                                                            </Text>
                                                            {creatorInfo.email ? (
                                                                <Text
                                                                    style={[
                                                                        styles.eventCreatorEmail,
                                                                        muteEvent && styles.pastEventMutedEmail,
                                                                    ]}
                                                                >
                                                                    {creatorInfo.email}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    </View>
                                        </Pressable>
                                    );
                                })}
                            </View>
                                    {firstFutureDateIndex !== -1 &&
                                        index === lastPastDateIndex && (
                                            <View style={styles.pastDivider} />
                                        )}
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedEvent && (() => {
                            const creatorInfo = getCreatorInfo(selectedEvent);
                            const initials = getInitials(creatorInfo.displayName, creatorInfo.email);

                            return (
                            <>
                                <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                                <Text style={styles.modalDate}>
                                    {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                                    {selectedEvent.endTime ? ` – ${selectedEvent.endTime}` : ''}
                                </Text>
                                {selectedEvent.location !== '' && (
                                    <Text style={styles.modalLocation}>📍 {selectedEvent.location}</Text>
                                )}
                                {selectedEvent.description !== '' && (
                                    <Text style={styles.modalDescription}>{selectedEvent.description}</Text>
                                )}
                                <View style={styles.modalCreatorInfo}>
                                    {creatorInfo.profileImageUrl ? (
                                        <Image
                                            source={{ uri: creatorInfo.profileImageUrl }}
                                            style={styles.modalCreatorAvatar}
                                        />
                                    ) : (
                                        <View style={styles.modalCreatorPlaceholder}>
                                            <Text style={styles.modalCreatorInitials}>{initials}</Text>
                                        </View>
                                    )}
                                    <View>
                                        <Text style={styles.modalCreatorName}>{creatorInfo.displayName}</Text>
                                        {creatorInfo.email ? (
                                            <Text style={styles.modalCreatorEmail}>{creatorInfo.email}</Text>
                                        ) : null}
                                    </View>
                                </View>

                                {isEventOwner(selectedEvent) && (
                                    <View style={styles.modalActionRow}>
                                        <Pressable
                                            onPress={() => handleDeleteEvent(selectedEvent)}
                                            style={styles.deleteIconButton}
                                        >
                                            <Ionicons name="trash-outline" size={24} color="#666" />
                                        </Pressable>
                                    </View>
                                )}

                                <Pressable style={styles.closeButton} onPress={() => setIsModalVisible(false)}>
                                    <Text style={styles.closeButtonText}>Close</Text>
                                </Pressable>
                            </>
                            );
                        })()}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    scrollView: {
        flex: 1,
    },
    createEventSection: {
        backgroundColor: 'white',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    formHeader: {
        padding: 15,
        backgroundColor: '#f0f8ff',
        borderRadius: 10,
        margin: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    createButtonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    createButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    createButtonEmoji: {
        fontSize: 24,
        marginRight: 10,
    },
    createHeaderText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#2c5f7c',
    },
    formContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    eventsSection: {
        backgroundColor: 'white',
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    dateGroup: {
        marginBottom: 20,
    },
    dateGroupHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3',
        marginBottom: 10,
        marginTop: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        fontSize: 16,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        backgroundColor: '#f9f9f9',
    },
    dateButtonText: {
        fontSize: 16,
        marginLeft: 10,
        color: '#333',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    createButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    createButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    eventCard: {
        backgroundColor: '#f9f9f9',
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#2196F3',
    },
    pastEventCard: {
        backgroundColor: '#dcdcdc',
        borderLeftColor: '#9e9e9e',
    },
    eventHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    headerActionsRow: {
        padding: 4,
    },
    eventTime: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    eventLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 5,
    },
    eventDescription: {
        fontSize: 14,
        color: '#444',
        marginBottom: 5,
    },
    eventCreator: {
        fontSize: 12,
        color: '#999',
        fontStyle: 'italic',
    },
    eventCreatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 10,
    },
    eventCreatorAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    eventCreatorPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2c5f7c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    eventCreatorInitials: {
        color: '#fff',
        fontWeight: '600',
    },
    eventCreatorName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    eventCreatorEmail: {
        fontSize: 12,
        color: '#666',
    },
    pastEventMutedEmail: {
        color: '#5c5c5c',
    },
    pastEventText: {
        color: '#5c5c5c',
    },
    pastDivider: {
        height: 1,
        backgroundColor: '#b5b5b5',
        marginVertical: 16,
        alignSelf: 'stretch',
        borderRadius: 1,
        opacity: 0.6,
    },
    noEvents: {
        textAlign: 'center',
        color: '#999',
        fontSize: 16,
        marginTop: 20,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    modalDate: {
        fontSize: 16,
        color: '#2196F3',
        marginBottom: 10,
    },
    modalLocation: {
        fontSize: 16,
        color: '#666',
        marginBottom: 10,
    },
    modalDescription: {
        fontSize: 16,
        color: '#444',
        marginBottom: 15,
    },
    modalCreator: {
        fontSize: 14,
        color: '#999',
        fontStyle: 'italic',
        marginBottom: 15,
    },
    modalCreatorInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        marginBottom: 12,
    },
    modalCreatorAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    modalCreatorPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#2c5f7c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCreatorInitials: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 18,
    },
    modalCreatorName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    modalCreatorEmail: {
        fontSize: 13,
        color: '#666',
    },
    modalActionRow: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    deleteIconButton: {
        padding: 8,
    },
    closeButton: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    closeButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});