package main

import (
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

// PricingRequest holds the input for a pricing calculation.
type PricingRequest struct {
	TrainerID      string  `json:"trainer_id" binding:"required"`
	BaseHourlyRate float64 `json:"base_hourly_rate" binding:"required,gt=0"`
	DurationMinutes int    `json:"duration_minutes" binding:"required,gt=0"`
	Date           string  `json:"date" binding:"required"` // YYYY-MM-DD
	StartTime      string  `json:"start_time" binding:"required"` // HH:MM (24-hour)
}

// PricingBreakdown describes each pricing factor applied.
type PricingBreakdown struct {
	BaseCalculation   string `json:"base_calculation"`
	DemandFactor      string `json:"demand_factor"`
	SeasonalFactor    string `json:"seasonal_factor"`
	FinalCalculation  string `json:"final_calculation"`
}

// PricingResponse is the response body for POST /pricing/calculate.
type PricingResponse struct {
	BasePrice          float64          `json:"base_price"`
	DemandMultiplier   float64          `json:"demand_multiplier"`
	SeasonalMultiplier float64          `json:"seasonal_multiplier"`
	FinalPrice         float64          `json:"final_price"`
	Breakdown          PricingBreakdown `json:"breakdown"`
}

// MarketRates is the response body for GET /pricing/rates.
type MarketRates struct {
	DemandMultipliers  DemandMultipliers  `json:"demand_multipliers"`
	SeasonalMultipliers SeasonalMultipliers `json:"seasonal_multipliers"`
	PeakHours          PeakHoursInfo      `json:"peak_hours"`
	Description        string             `json:"description"`
}

// DemandMultipliers lists all demand multiplier values.
type DemandMultipliers struct {
	PeakHoursWeekday float64 `json:"peak_hours_weekday"`
	Weekends         float64 `json:"weekends"`
	OffPeak          float64 `json:"off_peak"`
}

// SeasonalMultipliers lists all seasonal multiplier values.
type SeasonalMultipliers struct {
	Summer float64 `json:"summer"`
	Winter float64 `json:"winter"`
	SpringFall float64 `json:"spring_fall"`
}

// PeakHoursInfo describes when peak hours apply.
type PeakHoursInfo struct {
	Morning string `json:"morning"`
	Evening string `json:"evening"`
	Note    string `json:"note"`
}

// round2 rounds a float64 to 2 decimal places.
func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// demandMultiplier returns the demand multiplier for the given date and start time.
// Peak hours: 6–9 AM and 5–8 PM on weekdays = 1.3x
// Weekends = 1.2x
// Off-peak = 1.0x
func demandMultiplier(date time.Time, startHour int) float64 {
	weekday := date.Weekday()
	isWeekend := weekday == time.Saturday || weekday == time.Sunday

	if isWeekend {
		return 1.2
	}

	isPeakMorning := startHour >= 6 && startHour < 9
	isPeakEvening := startHour >= 17 && startHour < 20
	if isPeakMorning || isPeakEvening {
		return 1.3
	}

	return 1.0
}

// seasonalMultiplier returns the seasonal multiplier for the given month.
// Summer (Jun–Aug) = 1.15x, Winter (Dec–Feb) = 0.9x, Spring/Fall = 1.0x
func seasonalMultiplier(month time.Month) float64 {
	switch month {
	case time.June, time.July, time.August:
		return 1.15
	case time.December, time.January, time.February:
		return 0.9
	default:
		return 1.0
	}
}

// demandLabel returns a human-readable label for the demand multiplier.
func demandLabel(date time.Time, startHour int) string {
	weekday := date.Weekday()
	isWeekend := weekday == time.Saturday || weekday == time.Sunday
	if isWeekend {
		return "weekend"
	}
	isPeakMorning := startHour >= 6 && startHour < 9
	isPeakEvening := startHour >= 17 && startHour < 20
	if isPeakMorning || isPeakEvening {
		return "peak hours (weekday)"
	}
	return "off-peak"
}

// seasonLabel returns a human-readable label for the seasonal multiplier.
func seasonLabel(month time.Month) string {
	switch month {
	case time.June, time.July, time.August:
		return "summer"
	case time.December, time.January, time.February:
		return "winter"
	default:
		switch month {
		case time.March, time.April, time.May:
			return "spring"
		default:
			return "fall"
		}
	}
}

func calculateHandler(c *gin.Context) {
	var req PricingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse date
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date format, expected YYYY-MM-DD"})
		return
	}

	// Parse start_time to extract the hour
	var startHour int
	var startMinute int
	_, err = fmt.Sscanf(req.StartTime, "%d:%d", &startHour, &startMinute)
	if err != nil || startHour < 0 || startHour > 23 || startMinute < 0 || startMinute > 59 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format, expected HH:MM (24-hour)"})
		return
	}

	basePrice := round2(req.BaseHourlyRate * (float64(req.DurationMinutes) / 60.0))
	dm := demandMultiplier(date, startHour)
	sm := seasonalMultiplier(date.Month())
	finalPrice := round2(basePrice * dm * sm)

	breakdown := PricingBreakdown{
		BaseCalculation:  fmt.Sprintf("$%.2f/hr × %d min / 60 = $%.2f", req.BaseHourlyRate, req.DurationMinutes, basePrice),
		DemandFactor:     fmt.Sprintf("%.2fx (%s)", dm, demandLabel(date, startHour)),
		SeasonalFactor:   fmt.Sprintf("%.2fx (%s)", sm, seasonLabel(date.Month())),
		FinalCalculation: fmt.Sprintf("$%.2f × %.2f × %.2f = $%.2f", basePrice, dm, sm, finalPrice),
	}

	resp := PricingResponse{
		BasePrice:          basePrice,
		DemandMultiplier:   dm,
		SeasonalMultiplier: sm,
		FinalPrice:         finalPrice,
		Breakdown:          breakdown,
	}

	c.JSON(http.StatusOK, resp)
}

func ratesHandler(c *gin.Context) {
	rates := MarketRates{
		DemandMultipliers: DemandMultipliers{
			PeakHoursWeekday: 1.3,
			Weekends:         1.2,
			OffPeak:          1.0,
		},
		SeasonalMultipliers: SeasonalMultipliers{
			Summer:     1.15,
			Winter:     0.9,
			SpringFall: 1.0,
		},
		PeakHours: PeakHoursInfo{
			Morning: "06:00–09:00",
			Evening: "17:00–20:00",
			Note:    "Peak hour multipliers apply on weekdays only. Weekends use a flat 1.2x multiplier regardless of hour.",
		},
		Description: "Dynamic pricing multipliers currently in use by the BallBook platform.",
	}
	c.JSON(http.StatusOK, rates)
}

func healthHandler(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "pricing-service",
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "3004"
	}
	// Validate that port is a valid number
	if _, err := strconv.Atoi(port); err != nil {
		log.Fatalf("Invalid PORT value: %s", port)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	pricing := r.Group("/pricing")
	{
		pricing.POST("/calculate", calculateHandler)
		pricing.GET("/rates", ratesHandler)
		pricing.GET("/health", healthHandler)
	}

	addr := ":" + port
	log.Printf("Pricing service starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
