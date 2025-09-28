#!/usr/bin/env python3
"""
OMR (Optical Mark Recognition) Processor for Restaurant POS System
Processes scanned forms to detect marked selections and quantities
"""

import cv2
import numpy as np
import json
import sys
import os
from PIL import Image

class OMRProcessor:
    def __init__(self):
        """Initialize OMR processor with predefined form layout"""
        # Define mark positions for restaurant menu form
        # Each item has 2 marks: quantity (left) and selection (right)
        self.mark_positions = [
            # Row 1: isda, egg
            {"type": "quantity", "item": "isda", "x": 80, "y": 120, "width": 18, "height": 18},
            {"type": "selection", "item": "isda", "x": 320, "y": 120, "width": 18, "height": 18},
            {"type": "quantity", "item": "egg", "x": 480, "y": 120, "width": 18, "height": 18},
            {"type": "selection", "item": "egg", "x": 720, "y": 120, "width": 18, "height": 18},
            
            # Row 2: water, sinigang
            {"type": "quantity", "item": "water", "x": 80, "y": 168, "width": 18, "height": 18},
            {"type": "selection", "item": "water", "x": 320, "y": 168, "width": 18, "height": 18},
            {"type": "quantity", "item": "sinigang", "x": 480, "y": 168, "width": 18, "height": 18},
            {"type": "selection", "item": "sinigang", "x": 720, "y": 168, "width": 18, "height": 18},
            
            # Row 3: Chicken, pusit
            {"type": "quantity", "item": "Chicken", "x": 80, "y": 216, "width": 18, "height": 18},
            {"type": "selection", "item": "Chicken", "x": 320, "y": 216, "width": 18, "height": 18},
            {"type": "quantity", "item": "pusit", "x": 480, "y": 216, "width": 18, "height": 18},
            {"type": "selection", "item": "pusit", "x": 720, "y": 216, "width": 18, "height": 18},
            
            # Row 4: gatas, beef
            {"type": "quantity", "item": "gatas", "x": 80, "y": 264, "width": 18, "height": 18},
            {"type": "selection", "item": "gatas", "x": 320, "y": 264, "width": 18, "height": 18},
            {"type": "quantity", "item": "beef", "x": 480, "y": 264, "width": 18, "height": 18},
            {"type": "selection", "item": "beef", "x": 720, "y": 264, "width": 18, "height": 18},
        ]
        
        # Threshold for considering a mark as filled (percentage of dark pixels)
        self.mark_threshold = 0.3  # 30% dark pixels = marked
        
    def process_form(self, image_path):
        """
        Process OMR form and return detected marks
        
        Args:
            image_path (str): Path to the scanned form image
            
        Returns:
            dict: Processing results with detected marks and confidence scores
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return {"success": False, "error": "Could not load image"}
            
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Get image dimensions
            height, width = gray.shape
            
            # Process each mark position
            marks = []
            marked_items = []
            total_confidence = 0
            
            for pos in self.mark_positions:
                # Extract mark region
                x, y, w, h = pos["x"], pos["y"], pos["width"], pos["height"]
                
                # Ensure coordinates are within image bounds
                x = max(0, min(x, width - w))
                y = max(0, min(y, height - h))
                w = min(w, width - x)
                h = min(h, height - y)
                
                mark_region = gray[y:y+h, x:x+w]
                
                if mark_region.size == 0:
                    continue
                
                # Calculate mark detection
                total_pixels = mark_region.size
                # Count white pixels (assuming marks are dark on light background)
                white_pixels = np.sum(mark_region > 200)  # Threshold for white
                dark_pixels = total_pixels - white_pixels
                
                # Calculate confidence (percentage of dark pixels)
                confidence = dark_pixels / total_pixels if total_pixels > 0 else 0
                is_marked = confidence > self.mark_threshold
                
                # Create mark result
                mark_result = {
                    "type": pos["type"],
                    "item": pos["item"],
                    "position": {
                        "x": int(x),
                        "y": int(y),
                        "width": int(w),
                        "height": int(h)
                    },
                    "isMarked": bool(is_marked),
                    "confidence": float(confidence),
                    "whitePixels": int(white_pixels),
                    "totalPixels": int(total_pixels)
                }
                
                marks.append(mark_result)
                total_confidence += confidence
                
                # Track marked items for selection type marks
                if is_marked and pos["type"] == "selection":
                    marked_items.append(pos["item"])
            
            # Calculate overall confidence
            overall_confidence = total_confidence / len(marks) if marks else 0
            
            return {
                "success": True,
                "marks": marks,
                "confidence": overall_confidence,
                "image_dimensions": {
                    "width": width,
                    "height": height
                },
                "total_marks_detected": len(marks),
                "marked_items": marked_items
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}

def main():
    """Main function for command line usage"""
    if len(sys.argv) != 2:
        print("Usage: python omr_processor.py <image_path>", flush=True)
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}", flush=True)
        sys.exit(1)
    
    processor = OMRProcessor()
    result = processor.process_form(image_path)
    
    # Output only JSON result (no debug messages)
    print(json.dumps(result, indent=2), flush=True)

if __name__ == "__main__":
    main()
