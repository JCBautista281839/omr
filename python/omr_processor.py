import cv2
import numpy as np
import json
import sys
import os
from typing import Dict, List, Tuple, Optional

class OMRProcessor:
    def __init__(self):
        self.threshold_value = 127
        self.min_area = 100
        self.max_area = 5000
        self.menu_items = ['isda', 'egg', 'water', 'sinigang', 'Chicken', 'pusit', 'gatas', 'beef']
        
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """Preprocess the image for OMR detection"""
        # Read image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Could not load image: {image_path}")
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )
        
        return thresh
    
    def detect_corners(self, image: np.ndarray) -> List[Tuple[int, int]]:
        """Detect corner markers for form alignment"""
        # Find contours
        contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        corners = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > 1000:  # Filter large contours
                # Approximate contour
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                
                # Check if it's a corner marker (L-shape)
                if len(approx) >= 4:
                    # Get bounding rectangle
                    x, y, w, h = cv2.boundingRect(contour)
                    corners.append((x, y))
        
        return corners
    
    def detect_marks(self, image: np.ndarray, image_height: int, image_width: int) -> List[Dict]:
        """Detect marks in the form based on expected positions"""
        marks = []
        
        # Define expected positions for your form layout
        # Based on the form structure: 8 items in 2 columns
        positions = self._get_expected_positions(image_width, image_height)
        
        for pos in positions:
            mark_data = self._detect_mark_at_position(image, pos)
            if mark_data:
                marks.append(mark_data)
        
        return marks
    
    def _get_expected_positions(self, width: int, height: int) -> List[Dict]:
        """Define expected mark positions based on form layout"""
        positions = []
        
        # Calculate positions for 8 items in 2 columns
        item_height = height * 0.08  # 8% of image height per item
        start_y = height * 0.2  # Start 20% from top
        left_col_x = width * 0.1  # Left column at 10% from left
        right_col_x = width * 0.6  # Right column at 60% from left
        
        mark_size = min(width, height) * 0.03  # 3% of smaller dimension
        
        for i, item in enumerate(self.menu_items):
            row = i // 2
            col = i % 2
            
            y_pos = start_y + (row * item_height)
            x_pos = left_col_x if col == 0 else right_col_x
            
            # Quantity checkbox (left side)
            positions.append({
                'type': 'quantity',
                'item': item,
                'x': int(x_pos),
                'y': int(y_pos),
                'width': int(mark_size),
                'height': int(mark_size)
            })
            
            # Menu selection radio button (right side)
            positions.append({
                'type': 'selection',
                'item': item,
                'x': int(x_pos + width * 0.3),  # Offset for right column
                'y': int(y_pos),
                'width': int(mark_size),
                'height': int(mark_size)
            })
        
        return positions
    
    def _detect_mark_at_position(self, image: np.ndarray, position: Dict) -> Optional[Dict]:
        """Detect if a mark exists at a specific position"""
        x, y, w, h = position['x'], position['y'], position['width'], position['height']
        
        # Ensure coordinates are within image bounds
        x = max(0, min(x, image.shape[1] - w))
        y = max(0, min(y, image.shape[0] - h))
        
        # Extract region of interest
        roi = image[y:y+h, x:x+w]
        
        if roi.size == 0:
            return None
        
        # Count white pixels (marks appear as white after thresholding)
        white_pixels = cv2.countNonZero(roi)
        total_pixels = roi.size
        
        # Calculate mark confidence
        mark_ratio = white_pixels / total_pixels if total_pixels > 0 else 0
        is_marked = mark_ratio > 0.3  # Threshold for mark detection
        
        return {
            'type': position['type'],
            'item': position['item'],
            'position': {'x': x, 'y': y, 'width': w, 'height': h},
            'isMarked': is_marked,
            'confidence': round(mark_ratio, 3),
            'whitePixels': int(white_pixels),
            'totalPixels': int(total_pixels)
        }
    
    def calculate_overall_confidence(self, marks: List[Dict]) -> float:
        """Calculate overall confidence score for the processed form"""
        if not marks:
            return 0.0
        
        total_confidence = sum(mark['confidence'] for mark in marks)
        return round(total_confidence / len(marks), 2)
    
    def process_form(self, image_path: str) -> Dict:
        """Main method to process OMR form"""
        try:
            # Preprocess image
            processed_image = self.preprocess_image(image_path)
            
            # Get image dimensions
            height, width = processed_image.shape
            
            # Detect marks
            marks = self.detect_marks(processed_image, height, width)
            
            # Calculate overall confidence
            confidence = self.calculate_overall_confidence(marks)
            
            return {
                'success': True,
                'marks': marks,
                'confidence': confidence,
                'image_dimensions': {'width': width, 'height': height},
                'total_marks_detected': len(marks),
                'marked_items': [mark['item'] for mark in marks if mark['isMarked']]
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'marks': [],
                'confidence': 0.0
            }
    
    def extract_order_data(self, marks: List[Dict]) -> List[Dict]:
        """Extract order data from detected marks"""
        order_items = []
        
        # Group marks by item
        item_data = {}
        for mark in marks:
            item = mark['item']
            if item not in item_data:
                item_data[item] = {}
            item_data[item][mark['type']] = mark
        
        # Process each item
        for item_name, item_marks in item_data.items():
            quantity_mark = item_marks.get('quantity')
            selection_mark = item_marks.get('selection')
            
            # Only include items that are selected
            if selection_mark and selection_mark['isMarked']:
                # Determine quantity based on quantity mark
                quantity = 1
                if quantity_mark and quantity_mark['isMarked']:
                    # Could be enhanced to detect multiple quantity marks
                    quantity = 1
                
                order_items.append({
                    'item_name': item_name,
                    'quantity': quantity,
                    'confidence': min(
                        selection_mark['confidence'],
                        quantity_mark['confidence'] if quantity_mark else 1.0
                    )
                })
        
        return order_items

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python omr_processor.py <image_path>")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}")
        sys.exit(1)
    
    processor = OMRProcessor()
    result = processor.process_form(image_path)
    
    # Output JSON result
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
