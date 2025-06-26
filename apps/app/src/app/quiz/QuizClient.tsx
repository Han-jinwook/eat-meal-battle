"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDisplayDate, formatApiDate, getCurrentDate } from '@/utils/DateUtils';
import useUserSchool from '@/hooks/useUserSchool';
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';

// Quiz type definition
type Quiz = {
  id: string;
  question: string;
  options: string[];
  correct_answer?: number;
  explanation?: string;
  meal_date: string;
  meal_id?: string;
  user_answer?: {
    selected_option?: number;
    is_correct?: boolean;
  };
};

export default function QuizClient() {
  // CSS styles
  const styles = `
    .date-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
    }
    
    .date-button {
      padding: 0.5rem;
      border-radius: 0.375rem;
      text-align: center;
      transition: all 0.2s;
    }
    
    .date-button:hover {
      background-color: #e5e7eb;
    }
    
    .date-button.selected {
      background-color: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
    }
  `;

  // State management
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDate());
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [generatingQuiz, setGeneratingQuiz] = useState<boolean>(false);
  
  const { userSchool, loading: userLoading, error: userError } = useUserSchool();
  const supabase = createClient();
  
  // Handle date parameter from URL
  useEffect(() => {
    try {
      const dateParam = searchParams?.get('date');
      
      if (dateParam && typeof dateParam === 'string') {
        const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam) || /^\d{8}$/.test(dateParam);
        
        if (isValidDate) {
          try {
            if (dateParam.includes('-')) {
              const dateParts = dateParam.split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1;
                const day = parseInt(dateParts[2], 10);
                
                const date = new Date(year, month, day);
                if (!isNaN(date.getTime()) && 
                    date.getFullYear() === year && 
                    date.getMonth() === month && 
                    date.getDate() === day) {
                  setSelectedDate(dateParam);
                  return;
                }
              }
            } 
            else if (dateParam.length === 8) {
              const year = parseInt(dateParam.substring(0, 4), 10);
              const month = parseInt(dateParam.substring(4, 6), 10) - 1;
              const day = parseInt(dateParam.substring(6, 8), 10);
              
              const date = new Date(year, month, day);
              if (!isNaN(date.getTime()) && 
                  date.getFullYear() === year && 
                  date.getMonth() === month && 
                  date.getDate() === day) {
                setSelectedDate(dateParam);
                return;
              }
            }
            
            console.warn('Invalid date value:', dateParam);
            setSelectedDate(getCurrentDate());
          } catch (validationErr) {
            console.error('Date validation error:', validationErr);
            setSelectedDate(getCurrentDate());
          }
        } else {
          console.warn('Invalid date format:', dateParam);
          setSelectedDate(getCurrentDate());
        }
      } else {
        setSelectedDate(getCurrentDate());
      }
    } catch (err) {
      console.error('Error processing date parameter:', err);
      setSelectedDate(getCurrentDate());
    }
  }, [searchParams]);

  // Fetch quiz data
  const fetchQuiz = async () => {
    if (!userSchool || !selectedDate) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if quiz already exists
      const { data: existingQuiz, error: quizError } = await supabase
        .from('meal_quizzes')
        .select('*')
        .eq('meal_date', selectedDate)
        .eq('school_code', userSchool.school_code)
        .eq('grade', userSchool.grade)
        .single();

      if (quizError && quizError.code !== 'PGRST116') {
        throw quizError;
      }

      if (existingQuiz) {
        // Quiz exists, fetch user's answer
        const { data: userAnswer } = await supabase
          .from('quiz_results')
          .select('*')
          .eq('quiz_id', existingQuiz.id)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .single();

        setQuiz({
          ...existingQuiz,
          user_answer: userAnswer ? {
            selected_option: userAnswer.selected_option,
            is_correct: userAnswer.is_correct
          } : undefined
        });

        if (userAnswer) {
          setSelectedOption(userAnswer.selected_option);
          setSubmitted(true);
        }
      } else {
        // No quiz exists, need to generate one
        setGeneratingQuiz(true);
        
        // First, get meal data for this date
        const { data: mealData, error: mealError } = await supabase
          .from('meals')
          .select('*')
          .eq('meal_date', selectedDate)
          .eq('school_code', userSchool.school_code)
          .single();

        if (mealError || !mealData) {
          setError('No meal data found for this date');
          setGeneratingQuiz(false);
          setLoading(false);
          return;
        }

        // Generate quiz using OpenAI API
        const quizGenResponse = await fetch('/.netlify/functions/manual-generate-meal-quiz', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            school_code: userSchool.school_code,
            grade: userSchool.grade,
            meal_date: selectedDate,
            meal_id: mealData.id
          })
        });

        if (!quizGenResponse.ok) {
          throw new Error('Failed to generate quiz');
        }

        const quizGenResult = await quizGenResponse.json();
        
        if (quizGenResult.success) {
          toast.success('Quiz generated successfully!');
          // Refetch the quiz
          await fetchQuiz();
        } else {
          throw new Error(quizGenResult.error || 'Failed to generate quiz');
        }
        
        setGeneratingQuiz(false);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to load quiz');
      setGeneratingQuiz(false);
    } finally {
      setLoading(false);
    }
  };

  // Submit answer
  const submitAnswer = async () => {
    if (!quiz || selectedOption === null || !userSchool) return;

    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('User not authenticated');

      const isCorrect = selectedOption === quiz.correct_answer;

      const { error } = await supabase
        .from('quiz_results')
        .insert({
          quiz_id: quiz.id,
          user_id: user.id,
          selected_option: selectedOption,
          is_correct: isCorrect
        });

      if (error) throw error;

      setQuiz(prev => prev ? {
        ...prev,
        user_answer: {
          selected_option: selectedOption,
          is_correct: isCorrect
        }
      } : null);

      setSubmitted(true);
      toast.success(isCorrect ? 'Correct!' : 'Try again next time!');
    } catch (err) {
      console.error('Error submitting answer:', err);
      toast.error('Failed to submit answer');
    }
  };

  // Manual quiz generation
  const handleManualQuizGenerate = async () => {
    if (!userSchool || !selectedDate) return;

    try {
      setGeneratingQuiz(true);
      
      const { data: mealData, error: mealError } = await supabase
        .from('meals')
        .select('*')
        .eq('meal_date', selectedDate)
        .eq('school_code', userSchool.school_code)
        .single();

      if (mealError || !mealData) {
        toast.error('No meal data found for this date');
        return;
      }

      const response = await fetch('/.netlify/functions/manual-generate-meal-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          school_code: userSchool.school_code,
          grade: userSchool.grade,
          meal_date: selectedDate,
          meal_id: mealData.id
        })
      });

      const result = await response.json();
      
      if (result.success) {
        toast.success('Quiz generated successfully!');
        await fetchQuiz();
      } else {
        toast.error(result.error || 'Failed to generate quiz');
      }
    } catch (err) {
      console.error('Error generating quiz:', err);
      toast.error('Failed to generate quiz');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  // Date change handler
  const handleDateChange = (date: string | null | undefined) => {
    if (date && typeof date === 'string') {
      setSelectedDate(date);
      setQuiz(null);
      setSelectedOption(null);
      setSubmitted(false);
      setError(null);
      
      const params = new URLSearchParams(window.location.search);
      params.set('date', date);
      router.push(`/quiz?${params.toString()}`);
    }
  };

  // Date formatting
  const formatDateForDisplay = (date: Date | null): { month: number, day: number, weekday: string } => {
    if (!date) {
      const today = new Date();
      return {
        month: today.getMonth() + 1,
        day: today.getDate(),
        weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()]
      };
    }
    
    return {
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()]
    };
  };

  // Safe date formatting
  const safeFormatDate = (date: Date | null | undefined): string => {
    if (!date) return getCurrentDate();
    
    try {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (err) {
      console.error('Error formatting date:', err);
      return getCurrentDate();
    }
  };

  // Generate 7-day date range
  const getDateRange = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(safeFormatDate(date));
    }
    
    return dates;
  };

  // Load quiz when dependencies change
  useEffect(() => {
    if (userSchool && selectedDate && !userLoading) {
      fetchQuiz();
    }
  }, [userSchool, selectedDate, userLoading]);

  return (
    <>
      <style jsx>{styles}</style>

      <div className="max-w-4xl mx-auto">
        {/* School info display */}
        {userSchool ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm rounded p-2 mb-3 border-l-2 border-blue-500 flex items-center">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 text-base font-semibold">
              {userSchool.school_name}
            </span>
            {(userSchool.grade || userSchool.class) && (
              <span className="ml-2 text-gray-600 text-xs bg-white px-1.5 py-0.5 rounded-full">
                {userSchool.grade ? `Grade ${userSchool.grade}` : ''}
                {userSchool.class ? ` Class ${userSchool.class}` : ''}
              </span>
            )}
          </div>
        ) : (
          <div className="mb-6"></div>
        )}

        {/* Date selection */}
        <div className="mb-2 mt-1">
          <input
            type="date"
            id="quiz-date"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="sr-only"
          />
          <button 
            onClick={() => {
              const dateInput = document.getElementById('quiz-date') as HTMLInputElement;
              if (dateInput && dateInput.showPicker) {
                dateInput.showPicker();
              }
            }}
            className="text-gray-600 hover:text-gray-800 text-sm mb-2 flex items-center"
          >
            📅 Select Date
          </button>
          
          {/* 7-day date grid */}
          <div className="date-grid mb-4">
            {getDateRange().map((date) => {
              const dateObj = new Date(date + 'T00:00:00');
              const { month, day, weekday } = formatDateForDisplay(dateObj);
              const isSelected = date === selectedDate;
              
              return (
                <button
                  key={date}
                  onClick={() => handleDateChange(date)}
                  className={`date-button ${isSelected ? 'selected' : ''}`}
                >
                  <div className="text-xs text-gray-500">{weekday}</div>
                  <div className="text-sm font-medium">{month}/{day}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading state */}
        {(loading || userLoading || generatingQuiz) && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">
              {generatingQuiz ? 'Generating quiz...' : 'Loading...'}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleManualQuizGenerate}
              disabled={generatingQuiz}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generatingQuiz ? 'Generating...' : 'Generate Quiz'}
            </button>
          </div>
        )}

        {/* Quiz content */}
        {quiz && !loading && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-bold mb-4">{quiz.question}</h2>
            
            <div className="space-y-3 mb-6">
              {quiz.options.map((option, index) => {
                let optionClass = "border rounded-lg p-4 transition-colors cursor-pointer ";
                
                if (submitted && quiz.correct_answer !== undefined) {
                  if (index + 1 === quiz.correct_answer) {
                    optionClass += "bg-green-50 border-green-300";
                  } else if (index + 1 === selectedOption) {
                    optionClass += "bg-red-50 border-red-300";
                  } else {
                    optionClass += "border-gray-200";
                  }
                } else {
                  optionClass += selectedOption === index + 1
                    ? "bg-blue-50 border-blue-300"
                    : "hover:bg-gray-50 border-gray-200";
                }
                
                return (
                  <div
                    key={index}
                    className={optionClass}
                    onClick={() => {
                      if (!submitted) {
                        setSelectedOption(index + 1);
                      }
                    }}
                  >
                    <div className="flex items-start">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 text-gray-800 text-sm font-medium mr-3">
                        {index + 1}
                      </span>
                      <span>{option}</span>
                      
                      {submitted && quiz.correct_answer !== undefined && (
                        <div className="ml-auto">
                          {index + 1 === quiz.correct_answer ? (
                            <span className="text-green-500">✓</span>
                          ) : index + 1 === selectedOption ? (
                            <span className="text-red-500">✗</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Submit button or results */}
            <div>
              {!submitted ? (
                <button
                  disabled={selectedOption === null}
                  className={`w-full py-3 px-4 rounded-lg font-medium ${selectedOption === null
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                  onClick={submitAnswer}
                >
                  Submit Answer
                </button>
              ) : (
                <div>
                  {quiz.correct_answer !== undefined && quiz.user_answer && (
                    <div className="text-center">
                      <p className="text-lg font-semibold mb-2">
                        {quiz.user_answer.is_correct ? (
                          <span className="text-green-600">Correct! 🎉</span>
                        ) : (
                          <span className="text-red-600">Incorrect. Try again next time!</span>
                        )}
                      </p>
                      
                      {/* Explanation */}
                      {quiz.explanation && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">💡 Explanation</p>
                          <p className="text-gray-600">{quiz.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
