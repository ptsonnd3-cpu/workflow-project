import React from 'react';

export const WorkflowListSkeleton = ({ count = 5 }) => (
  <div className="skeleton-container">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="workflow-item-skeleton">
        <div className="skeleton-line skeleton-title"></div>
        <div className="skeleton-line skeleton-text"></div>
        <div className="skeleton-line skeleton-text short"></div>
        <div className="skeleton-actions">
          <div className="skeleton-button"></div>
          <div className="skeleton-button"></div>
          <div className="skeleton-button"></div>
        </div>
      </div>
    ))}
    <style jsx>{`
      .skeleton-container {
        padding: 20px;
      }
      .workflow-item-skeleton {
        padding: 15px;
        margin-bottom: 15px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background: white;
      }
      .skeleton-line {
        height: 16px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 8px;
      }
      .skeleton-title {
        height: 20px;
        width: 60%;
      }
      .skeleton-text {
        width: 80%;
      }
      .skeleton-text.short {
        width: 40%;
      }
      .skeleton-actions {
        display: flex;
        gap: 10px;
        margin-top: 15px;
      }
      .skeleton-button {
        width: 80px;
        height: 32px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
      }
      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

export const WorkflowDetailSkeleton = () => (
  <div className="workflow-detail-skeleton">
    <div className="skeleton-header">
      <div className="skeleton-line skeleton-title"></div>
      <div className="skeleton-line skeleton-text"></div>
    </div>
    
    <div className="skeleton-tabs">
      <div className="skeleton-tab"></div>
      <div className="skeleton-tab"></div>
      <div className="skeleton-tab"></div>
    </div>
    
    <div className="skeleton-content">
      <div className="skeleton-section">
        <div className="skeleton-section-title"></div>
        <div className="skeleton-table">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton-table-row">
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell"></div>
              <div className="skeleton-cell short"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
    
    <style jsx>{`
      .workflow-detail-skeleton {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .skeleton-header {
        margin-bottom: 30px;
      }
      .skeleton-tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 30px;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 10px;
      }
      .skeleton-tab {
        width: 100px;
        height: 40px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
      }
      .skeleton-section {
        margin-bottom: 30px;
      }
      .skeleton-section-title {
        width: 200px;
        height: 24px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 15px;
      }
      .skeleton-table {
        border: 1px solid #e0e0e0;
        border-radius: 4px;
      }
      .skeleton-table-row {
        display: flex;
        gap: 10px;
        padding: 15px;
        border-bottom: 1px solid #e0e0e0;
      }
      .skeleton-table-row:last-child {
        border-bottom: none;
      }
      .skeleton-cell {
        flex: 1;
        height: 16px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
      }
      .skeleton-cell.short {
        flex: 0.5;
      }
      .skeleton-line {
        height: 16px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
        margin-bottom: 8px;
      }
      .skeleton-title {
        height: 32px;
        width: 300px;
        margin-bottom: 15px;
      }
      .skeleton-text {
        width: 500px;
      }
      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

export const BPMNEditorSkeleton = () => (
  <div className="bpmn-editor-skeleton">
    <div className="skeleton-toolbar">
      <div className="skeleton-button"></div>
      <div className="skeleton-button"></div>
      <div className="skeleton-button"></div>
    </div>
    <div className="skeleton-canvas">
      <div className="skeleton-palette"></div>
      <div className="skeleton-diagram">
        <div className="skeleton-element"></div>
        <div className="skeleton-element"></div>
        <div className="skeleton-element"></div>
        <div className="skeleton-connector"></div>
        <div className="skeleton-connector"></div>
      </div>
    </div>
    
    <style jsx>{`
      .bpmn-editor-skeleton {
        width: 100%;
        margin: 20px 0;
      }
      .skeleton-toolbar {
        display: flex;
        gap: 10px;
        padding: 10px;
        background: #f5f5f5;
        border: 1px solid #ccc;
        border-bottom: none;
      }
      .skeleton-button {
        width: 80px;
        height: 32px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
      }
      .skeleton-canvas {
        display: flex;
        height: 500px;
        border: 1px solid #ccc;
        background: white;
      }
      .skeleton-palette {
        width: 60px;
        background: #f8f9fa;
        border-right: 1px solid #e0e0e0;
        padding: 10px 5px;
      }
      .skeleton-diagram {
        flex: 1;
        position: relative;
        background: linear-gradient(45deg, #f9f9f9 25%, transparent 25%), 
                    linear-gradient(-45deg, #f9f9f9 25%, transparent 25%), 
                    linear-gradient(45deg, transparent 75%, #f9f9f9 75%), 
                    linear-gradient(-45deg, transparent 75%, #f9f9f9 75%);
        background-size: 20px 20px;
        background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      }
      .skeleton-element {
        position: absolute;
        width: 100px;
        height: 60px;
        background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
        border-radius: 4px;
      }
      .skeleton-element:nth-child(1) {
        top: 50px;
        left: 50px;
      }
      .skeleton-element:nth-child(2) {
        top: 200px;
        left: 250px;
      }
      .skeleton-element:nth-child(3) {
        top: 350px;
        left: 450px;
      }
      .skeleton-connector {
        position: absolute;
        height: 2px;
        background: linear-gradient(90deg, #e0e0e0 25%, #d0d0d0 50%, #e0e0e0 75%);
        background-size: 200% 100%;
        animation: loading 1.5s infinite;
      }
      .skeleton-connector:nth-child(4) {
        top: 80px;
        left: 150px;
        width: 100px;
      }
      .skeleton-connector:nth-child(5) {
        top: 230px;
        left: 350px;
        width: 100px;
      }
      @keyframes loading {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
    `}</style>
  </div>
);

export default { WorkflowListSkeleton, WorkflowDetailSkeleton, BPMNEditorSkeleton };