import React from 'react'
import { useSpeechSynthesis } from 'react-speech-kit'
import { Button } from './ui/button'

interface TextToSpeechButtonProps {
    text: string;
}

const TextToSpeechButton = ({ text }: TextToSpeechButtonProps) => {
    const { speak, cancel, speaking, supported } = useSpeechSynthesis();

    const handleSpeak = () => {
        if (supported) {
            speak({ text });
        } else {
            alert('Sorry, your browser does not support text to speech.');
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            <Button onClick={handleSpeak} variant="outline" className='w-full bg-green-600 hover:bg-green-700 cursor-pointer'>
                🔊 {speaking ? 'Speaking...' : 'Read Aloud'}
            </Button>
            {speaking && (
                <Button onClick={cancel} variant="destructive" className='w-full bg-red-600 hover:bg-red-700 cursor-pointer'>
                    🛑 Stop
                </Button>
            )}
        </div>
    )
}

export default TextToSpeechButton