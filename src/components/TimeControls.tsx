import React, { useState, useEffect } from 'react';
import { getTimeSnapshot, getAvailableSnapshotTimes } from '../services/timeSnapshotService';
import { NewsCategory, TimeSnapshot } from '../types';
import './TimeControls.css';

interface TimeControlsProps {
  isTimeMachineMode: boolean;
  onToggleMode: () => void;
  currentTime: Date;
  onTimeChange: (date: Date) => void;
  onSnapshotChange?: (snapshot: TimeSnapshot | null) => void;
}

const TimeControls: React.FC<TimeControlsProps> = ({
  isTimeMachineMode,
  onToggleMode,
  currentTime,
  onTimeChange,
  onSnapshotChange
}) => {
  const [availableSnapshots, setAvailableSnapshots] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);

  // Initialize mock snapshots on first render
  useEffect(() => {
    if (!initialized) {
      const initialize = async () => {
        setAvailableSnapshots(getAvailableSnapshotTimes());
        setInitialized(true);
      };
      
      initialize();
    }
  }, [initialized]);

  // Update available snapshots when time machine mode changes
  useEffect(() => {
    if (isTimeMachineMode && initialized) {
      setAvailableSnapshots(getAvailableSnapshotTimes());
    }
  }, [isTimeMachineMode, initialized]);

  // Load snapshot when time changes in time machine mode
  useEffect(() => {
    if (isTimeMachineMode && initialized) {
      const loadSnapshot = async () => {
        setLoading(true);
        try {
          // Get the snapshot for the selected time
          const snapshot = await getTimeSnapshot(currentTime);
          
          if (onSnapshotChange) {
            onSnapshotChange(snapshot);
          }
        } catch (error) {
          console.error('Error loading snapshot:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadSnapshot();
    }
  }, [currentTime, isTimeMachineMode, initialized, onSnapshotChange]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = new Date(e.target.value);
    onTimeChange(newTime);
  };

  const handleTimelineClick = (date: Date) => {
    onTimeChange(date);
  };

  // Get current date in format YYYY-MM-DDThh:mm
  const formatDateForInput = (date: Date) => {
    return date.toISOString().slice(0, 16);
  };

  // Get today's date at 00:00 for min value
  const getTodayStart = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString().slice(0, 16);
  };

  // Get current time for max value
  const getCurrentTime = () => {
    return new Date().toISOString().slice(0, 16);
  };

  return (
    <div className={`time-controls ${isTimeMachineMode ? 'time-machine-active' : ''}`}>
      <div className="time-display">
        <div className="current-time">
          {isTimeMachineMode ? 'HISTORICAL VIEW' : 'LIVE'}:
          <span className="time-value">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {loading && <span className="loading-indicator"> (Loading...)</span>}
        </div>
      </div>
      
      <div className="time-machine-controls">
        <button 
          className={`time-machine-toggle ${isTimeMachineMode ? 'active' : ''}`}
          onClick={onToggleMode}
        >
          {isTimeMachineMode ? 'Return to Live' : 'Time Machine'}
        </button>
        
        {isTimeMachineMode && (
          <div className="time-slider-container">
            <input
              type="datetime-local"
              className="time-slider"
              min={getTodayStart()}
              max={getCurrentTime()}
              value={formatDateForInput(currentTime)}
              onChange={handleTimeChange}
            />
          </div>
        )}
      </div>
      
      {isTimeMachineMode && availableSnapshots.length > 0 && (
        <div className="time-timeline">
          <div className="timeline-label">Available Snapshots:</div>
          <div className="timeline-points">
            {availableSnapshots.map((date, index) => (
              <button
                key={index}
                className={`timeline-point ${
                  Math.abs(date.getTime() - currentTime.getTime()) < 60000 ? 'active' : ''
                }`}
                onClick={() => handleTimelineClick(date)}
                title={date.toLocaleString()}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Future feature: Personalized alerts */}
      <div className="future-features">
        <span className="coming-soon">Coming Soon:</span>
        <button className="feature-button" disabled>
          Personalized Alerts
        </button>
        <button className="feature-button" disabled>
          Geographic Overlay
        </button>
      </div>
    </div>
  );
};

export default TimeControls;
