import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase.config';
import EmailVerificationBanner from '../components/EmailVerificationBanner';
import { sendNotificationToUsers } from '../utils/notifications';

interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    time: string;
    description: string;
    location: string;
    createdBy: string;
    createdByEmail: string;
}

export default function CalendarScreen() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [isFormExpanded, setIsFormExpanded] = useState(false);

    const [newEvent, setNewEvent] = useState({
        title: '',
        date: new Date(),
        time: new Date(),
        description: '',
        location: '',
    });

    const isEmailVerified = auth.currentUser?.emailVerified ?? false;

    useEffect(() => {
        const q = query(collection(db, 'events'), orderBy('date', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData: CalendarEvent[] = [];

            snapshot.docs.forEach((docSnap) => {
                const data = docSnap.data();

                eventsData.push({
                    id: docSnap.id,
                    title: String(data.title || ''),
                    date: String(data.date || ''),
                    time: String(data.time || ''),
                    description: String(data.description || ''),
                    location: String(data.location || ''),
                    createdBy: String(data.createdBy || ''),
                    createdByEmail: String(data.createdByEmail || ''),
                });
            });

            setEvents(eventsData);
        });

        return () => unsubscribe();
    }, []);

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

            await addDoc(collection(db, 'events'), {
                title: newEvent.title,
                date: eventDate,
                time: eventTime,
                description: newEvent.description,
                location: newEvent.location,
                createdBy: auth.currentUser?.uid || '',
                createdByEmail: auth.currentUser?.email || '',
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

    return (
        <View style={styles.container}>
            {!isEmailVerified && <EmailVerificationBanner />}

            <ScrollView style={styles.scrollView}>
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
                    <Text style={styles.sectionTitle}>Upcoming Events</Text>

                    {sortedDates.length === 0 ? (
                        <Text style={styles.noEvents}>No upcoming events</Text>
                    ) : (
                        sortedDates.map((date) => (
                            <View key={date} style={styles.dateGroup}>
                                <Text style={styles.dateGroupHeader}>
                                    {new Date(date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </Text>
                                {groupedEvents[date].map((event) => {
                                    const owner = isEventOwner(event);

                                    return (
                                        <Pressable
                                            key={event.id}
                                            style={styles.eventCard}
                                            onPress={() => {
                                                setSelectedEvent(event);
                                                setIsModalVisible(true);
                                            }}
                                        >
                                            <View style={styles.eventHeader}>
                                                <View>
                                                    <Text style={styles.eventTime}>{event.time}</Text>
                                                </View>
                                                {owner && (
                                                    <Pressable
                                                        onPress={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteEvent(event);
                                                        }}
                                                        style={styles.headerActionsRow}
                                                    >
                                                        <Ionicons name="trash-outline" size={20} color="#666" />
                                                    </Pressable>
                                                )}
                                            </View>
                                            <Text style={styles.eventTitle}>{event.title}</Text>
                                            {event.location !== '' && <Text style={styles.eventLocation}>📍 {event.location}</Text>}
                                            {event.description !== '' && <Text style={styles.eventDescription}>{event.description}</Text>}
                                            <Text style={styles.eventCreator}>by {event.createdByEmail}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>

            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {selectedEvent && (
                            <>
                                <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                                <Text style={styles.modalDate}>
                                    {new Date(selectedEvent.date).toLocaleDateString()} at {selectedEvent.time}
                                </Text>
                                {selectedEvent.location !== '' && (
                                    <Text style={styles.modalLocation}>📍 {selectedEvent.location}</Text>
                                )}
                                {selectedEvent.description !== '' && (
                                    <Text style={styles.modalDescription}>{selectedEvent.description}</Text>
                                )}
                                <Text style={styles.modalCreator}>Created by {selectedEvent.createdByEmail}</Text>

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
                        )}
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