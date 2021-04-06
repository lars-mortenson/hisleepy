import { Client as DiscordClient, VoiceChannel, VoiceConnection } from 'discord.js'
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly'
import { Readable } from 'stream';
import {
  AudioStream,
  LanguageCode,
  MediaEncoding,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient
} from "@aws-sdk/client-transcribe-streaming";
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const region = 'us-east-1';

const discord = new DiscordClient();
const polly = new PollyClient({ region });
const ssm = new SSMClient({ region });
const transcribeClient = new TranscribeStreamingClient({ region })

let connection: VoiceConnection;

const userStreams: Record<string, Readable> = {};

const dadJokeMatch = /(I'm|I am)(( [^.,\s]+){1,4})/i

const sayDadJoke = async (fakeName: string) => {
  const result = await polly.send(new SynthesizeSpeechCommand({
    OutputFormat: 'mp3',
    VoiceId: 'Bianca',
    Text: `Hi ${fakeName}, I'm Bianca!`,
    TextType: 'text',
  }));

  if (!result.AudioStream) {
    console.log('Audio stream was empty');
    return Promise.reject();
  }

  const dispatcher = connection.play(result.AudioStream as Readable, {
    type: 'unknown'
  });

  dispatcher.on('start', () => {
    console.log('Sound is now playing!');
  });

  dispatcher.on('finish', () => {
    console.log('Sound has finished playing!');
  });

  dispatcher.on('error', console.error);
}

async function* pcmStereoToMono(audio: Readable): AsyncIterable<AudioStream> {
  for await (const chunk of (audio as AsyncIterable<Buffer>)) {
    yield {
      AudioEvent: {
        AudioChunk: Buffer.from(chunk.filter((_, i) => (i % 4) in [0, 1]))
      }
    }
  }
}

// Register an event so that when the bot is ready, it will log a messsage to the terminal
discord.on('ready', async () => {
  console.log(`Logged in as ${discord.user?.tag}!`);
})

const joinChannel = async (channelId: string) => {
  const voiceChannel = discord.channels.cache.get(channelId);
  if (!voiceChannel) {
    console.log(`Not a voice channel: ${channelId}`)
    return;
  }
  connection = await (voiceChannel as VoiceChannel).join();
  connection.on('error', (err) => {
    console.log(`A sad thing happened: ${err}`);
  })
  connection.on('speaking', async (who, isSpeaking) => {
    if (isSpeaking) {
      console.log(`${who.username} Is Speaking`);
      const audio = connection.receiver.createStream(who.id, { mode: 'pcm', end: 'silence' });
      userStreams[who.id] = audio;
      const result = await transcribeClient.send(new StartStreamTranscriptionCommand({
        LanguageCode: LanguageCode.EN_US,
        MediaSampleRateHertz: 48000,
        MediaEncoding: MediaEncoding.PCM,
        AudioStream: pcmStereoToMono(audio) // Transcribe expects mono 16-bit PCM
      }));

      try {
        for await (const transcript of result.TranscriptResultStream ?? []) {
          for (const result of (transcript.TranscriptEvent?.Transcript?.Results?.filter((result) => !result.IsPartial)) ?? []) {
            for (const item of (result.Alternatives?.filter((alt) => !!alt.Transcript)) ?? []) {
              if (item.Transcript) {
                const match = dadJokeMatch.exec(item.Transcript);
                if (match && match[2]) {
                  await sayDadJoke(match[2]);
                }
              }
            }
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
  })
}

discord.on('message', async (message) => {
  if (message.member && message.mentions.users.has(discord.user?.id || '')) {
    if (message.content.includes('!join') && message.member.voice.channelID) {
      await joinChannel(message.member.voice.channelID);
    } else if (message.content.includes('!leave')) {
      message.guild?.me?.voice.setChannel(null);
    }
  }
})

ssm.send(new GetParameterCommand({
  Name: '/hisleepy/discordkey',
  WithDecryption: true
})).then((result) => discord.login(result.Parameter?.Value)).catch((err) => {
  console.log(`Faild to get discord key: ${err}`)
});

