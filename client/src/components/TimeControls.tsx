import React, { useState, useEffect, useRef } from 'react';
import { getTimeSnapshot, getAllSnapshotTimestamps } from '../services/timeSnapshotService';
import { NewsCategory, TimeSnapshot } from '../types';
import './TimeControls.css';

interface TimeControlsProps {
  onSnapshotChange: (snapshot: TimeSnapshot | null) => void;
  initialTime?: Date;
}

const TimeControls: React.FC<TimeControlsProps> = ({ onSnapshotChange, initialTime }) => {
  const [currentTime, setCurrentTime] = useState<Date>(initialTime || new Date());
  const [availableTimestamps, setAvailableTimestamps] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch available timestamps on mount
  useEffect(() => {
    const timestamps = getAllSnapshotTimestamps();
    setAvailableTimestamps(timestamps);
    // If initial time is provided, maybe try to load that specific snapshot?
    // Or just default to the latest?
    if (timestamps.length > 0 && !initialTime) {
       setCurrentTime(new Date(timestamps[0])); // Default to latest available timestamp
    }
  }, [initialTime]);

  // Effect to load snapshot when currentTime changes (COMMENTED OUT - NEEDS REFACTOR)
  /*
  useEffect(() => {
    const loadSnapshot = async () => {
      if (!onSnapshotChange) return;

      if (!currentTime) {
        onSnapshotChange(null);
        return;
      }

      try {
        // Get the snapshot for the selected time (Needs refactor: getTimeSnapshot needs exact string)
        const snapshot = await getTimeSnapshot(currentTime.toISOString()); // Pass ISO string
        
        if (onSnapshotChange) {
          onSnapshotChange(snapshot ?? null); // Convert undefined to null
        }
      } catch (error) {
        console.error('Error loading snapshot:', error);
        onSnapshotChange(null);
      }
    };

    loadSnapshot();
  }, [currentTime, onSnapshotChange]);
  */

  // Handle slider change
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // This logic needs update if slider represents index in availableTimestamps array
    const newTimestamp = event.target.value; 
    // Assuming value is the timestamp string from availableTimestamps
    if (availableTimestamps.includes(newTimestamp)) {
       setCurrentTime(new Date(newTimestamp));
    }
  };

  // Handle play/pause
  const togglePlay = () => {
     // Playback logic needs complete refactor based on available timestamps
    setIsPlaying(!isPlaying);
    console.warn('Playback controls need refactoring.');
    if (isPlaying && intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  };

  // Placeholder for slider rendering - needs update based on availableTimestamps
  const renderSlider = () => {
    if (availableTimestamps.length === 0) {
      return <p>No time snapshots available.</p>;
    }
    // Example: map availableTimestamps to slider ticks/values
    const minTime = availableTimestamps[availableTimestamps.length - 1];
    const maxTime = availableTimestamps[0];

    return (
      <input
        type="range"
        min={0} // Use index?
        max={availableTimestamps.length - 1} // Use index?
        // value={currentTime.toISOString()} // This needs to map to the slider scale
        onChange={handleSliderChange}
        className="time-slider"
        disabled={isPlaying}
      />
    );
  };

  return (
    <div className="time-controls">
      <button onClick={togglePlay} disabled={availableTimestamps.length === 0}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <span className="current-time-display">
        {currentTime.toLocaleString()}
      </span>
      {renderSlider()}
    </div>
  );
};

export default TimeControls;
